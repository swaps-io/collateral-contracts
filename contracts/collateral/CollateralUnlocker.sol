// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {HashStorage} from "../storage/HashStorage.sol";

import {EnvLib} from "../utils/EnvLib.sol";
import {EventHashLib} from "../utils/EventHashLib.sol";

import {ICollateralUnlocker, IERC20, IProofVerifier, IAccessWhitelist} from "./interfaces/ICollateralUnlocker.sol";

import {CollateralLib} from "./CollateralLib.sol";

abstract contract CollateralUnlocker is ICollateralUnlocker, HashStorage {
    using SafeERC20 for IERC20;

    uint8 public immutable DECIMALS;
    uint256 public immutable TOTAL_BALANCE_TOKENS;

    uint256 private immutable _VARIANT;
    IProofVerifier private immutable _PROOF_VERIFIER;
    IAccessWhitelist private immutable _ACCESS_WHITELIST;

    // solhint-disable-next-line var-name-mixedcase
    mapping(address token => uint256) private _BALANCE_TOKEN_DATA; // Immutable
    // solhint-disable-next-line var-name-mixedcase
    uint256[] private _BALANCE_TOKEN_DATA_LIST; // Immutable

    mapping(address account => mapping(uint256 lockChain => mapping(address token => uint256))) public balanceByToken;

    mapping(address account => mapping(uint256 lockChain => uint256)) public unlockCounter;
    mapping(address account => mapping(uint256 lockChain => uint256)) public unlockWithdrawNonce;

    // prettier-ignore
    constructor(uint8 decimals_, uint168[] memory balanceTokenData_, uint256 variant_, address proofVerifier_, address accessWhitelist_) {
        DECIMALS = decimals_;
        TOTAL_BALANCE_TOKENS = balanceTokenData_.length;

        _VARIANT = variant_;
        _PROOF_VERIFIER = IProofVerifier(proofVerifier_);
        _ACCESS_WHITELIST = IAccessWhitelist(accessWhitelist_);

        if (TOTAL_BALANCE_TOKENS > 0xFFFFFFFFFFFFFFFFFFFFFF) revert TooManyBalanceTokens(); // 88 bits available
        for (uint256 i = 0; i < TOTAL_BALANCE_TOKENS; i++) {
            uint256 tokenData = (i << 168) | balanceTokenData_[i];
            if (_balanceTokenAddress(tokenData) == address(0)) revert InvalidBalanceTokenAddress(i);
            if (_balanceTokenDecimals(tokenData) > DECIMALS) revert TooManyBalanceTokenDecimals(i);
            if (isBalanceToken(_balanceTokenAddress(tokenData))) revert BalanceTokenDataOverride(i);
            _BALANCE_TOKEN_DATA[_balanceTokenAddress(tokenData)] = tokenData;
            _BALANCE_TOKEN_DATA_LIST.push(tokenData);
        }
    }

    modifier withUnlockAccess(address account_) {
        if (!_ACCESS_WHITELIST.isApproved(account_, msg.sender)) revert UnauthorizedUnlockAccess(msg.sender);
        _;
    }

    function balance(address account_, uint256 lockChain_) external view returns (uint256 totalBalance) {
        for (uint256 i = 0; i < TOTAL_BALANCE_TOKENS; i++)
            totalBalance += balanceByToken[account_][lockChain_][_balanceTokenAddress(_BALANCE_TOKEN_DATA_LIST[i])];
    }

    // prettier-ignore
    function isBalanceToken(address token_) public view returns (bool) { return _isBalanceToken(_BALANCE_TOKEN_DATA[token_]); }

    // prettier-ignore
    function balanceTokenIndex(address token_) external view returns (uint256) { return _balanceTokenIndex(_BALANCE_TOKEN_DATA[token_]); }

    // prettier-ignore
    function balanceTokenDecimals(address token_) external view returns (uint8) { return _balanceTokenDecimals(_BALANCE_TOKEN_DATA[token_]); }

    // prettier-ignore
    function balanceTokenByIndex(uint256 tokenIndex_) external view returns (address) { return _balanceTokenAddress(_BALANCE_TOKEN_DATA_LIST[tokenIndex_]); }

    function deposit(address token_, uint256 tokenAmount_, uint256 lockChain_) external {
        uint256 amount = _convertAmount(tokenAmount_, _checkedBalanceDecimals(token_), DECIMALS);

        IERC20(token_).safeTransferFrom(msg.sender, address(this), tokenAmount_);
        balanceByToken[msg.sender][lockChain_][token_] += amount;
        unlockCounter[msg.sender][lockChain_] += amount;

        emit Deposit(msg.sender, token_, amount, lockChain_);
    }

    function withdraw(address token_, uint256 amount_, uint256 lockChain_, uint256 lockCounter_, bytes calldata reportProof_) external {
        uint256 tokenAmount = _convertAmount(amount_, DECIMALS, _checkedBalanceDecimals(token_));

        uint256 unlockCount = unlockCounter[msg.sender][lockChain_];
        if (lockCounter_ > unlockCount) revert WithdrawRefusal();

        uint256 nonce = unlockWithdrawNonce[msg.sender][lockChain_];
        bytes32 reportHash = CollateralLib.calcWithdrawReportHash(_VARIANT, lockChain_, EnvLib.thisChain(), msg.sender, lockCounter_, amount_, nonce);
        _PROOF_VERIFIER.verifyHashEventProof(CollateralLib.WITHDRAW_REPORT_SIG, reportHash, lockChain_, reportProof_);
        unlockWithdrawNonce[msg.sender][lockChain_] = nonce + 1;

        uint256 tokenBalance = balanceByToken[msg.sender][lockChain_][token_];
        if (tokenBalance < amount_) revert InsufficientTokenBalance(token_, msg.sender, tokenBalance, amount_);
        balanceByToken[msg.sender][lockChain_][token_] = tokenBalance - amount_;
        IERC20(token_).safeTransfer(msg.sender, tokenAmount);

        emit Withdraw(msg.sender, token_, amount_, lockChain_);
    }

    function skipWithdraw(uint256 lockChain_, uint256 firstNonce_, uint256 lastNonce_) external {
        uint256 nonce = unlockWithdrawNonce[msg.sender][lockChain_];
        if (nonce != firstNonce_ || lastNonce_ < firstNonce_) revert InvalidWithdrawSkip();

        unlockWithdrawNonce[msg.sender][lockChain_] = nonce + 1 + (lastNonce_ - firstNonce_);
    }

    function approveUnlock(address account_, uint256 amount_, uint256 lockChain_) external withUnlockAccess(account_) {
        unlockCounter[account_][lockChain_] += amount_;
    }

    function rejectUnlock(address account_, uint256 amount_, uint256 lockChain_, address receiver_) external withUnlockAccess(account_) {
        _sendBalance(account_, amount_, lockChain_, receiver_);
    }

    function reportUnlockCounterUpdate(address account_, uint256 lockChain_) external {
        bytes32 reportHash = CollateralLib.calcUnlockReportHash(_VARIANT, EnvLib.thisChain(), lockChain_, account_, unlockCounter[account_][lockChain_]);

        _storeHash(EventHashLib.calcEventHash(CollateralLib.UNLOCK_REPORT_SIG, reportHash));

        emit UnlockReport(reportHash);
    }

    // prettier-ignore
    function _isBalanceToken(uint256 tokenData_) private pure returns (bool) { return tokenData_ != 0; }

    // prettier-ignore
    function _balanceTokenDecimals(uint256 tokenData_) private pure returns (uint8) { return uint8(tokenData_); }

    // prettier-ignore
    function _balanceTokenAddress(uint256 tokenData_) private pure returns (address) { return address(uint160(tokenData_ >> 8)); }

    // prettier-ignore
    function _balanceTokenIndex(uint256 tokenData_) private pure returns (uint256) { return tokenData_ >> 168; }

    function _checkedBalanceDecimals(address token_) private view returns (uint8) {
        uint256 tokenData = _BALANCE_TOKEN_DATA[token_];
        if (!_isBalanceToken(tokenData)) revert BalanceTokenNotSupported(token_);
        return _balanceTokenDecimals(tokenData);
    }

    function _convertAmount(uint256 amount_, uint8 decimals_, uint8 toDecimals_) private pure returns (uint256) {
        if (toDecimals_ > decimals_) return amount_ * (10 ** (toDecimals_ - decimals_));
        if (decimals_ > toDecimals_) return amount_ / (10 ** (decimals_ - toDecimals_));
        return amount_;
    }

    function _sendBalance(address account_, uint256 amount_, uint256 lockChain_, address receiver_) private {
        uint256 tokenIndex = 0;
        while (amount_ > 0) {
            uint256 tokenData = _BALANCE_TOKEN_DATA_LIST[tokenIndex];
            uint256 tokenBalance = balanceByToken[account_][lockChain_][_balanceTokenAddress(tokenData)];
            uint256 availableAmount = tokenBalance < amount_ ? tokenBalance : amount_;
            balanceByToken[account_][lockChain_][_balanceTokenAddress(tokenData)] = tokenBalance - availableAmount;
            IERC20(_balanceTokenAddress(tokenData)).safeTransfer(receiver_, _convertAmount(availableAmount, DECIMALS, _balanceTokenDecimals(tokenData)));
            amount_ -= availableAmount;
            unchecked { tokenIndex++; } // prettier-ignore
        }
    }
}
