// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IProofVerifier} from "../../proof/interfaces/IProofVerifier.sol";

import {IAccessWhitelist} from "../../whitelist/interfaces/IAccessWhitelist.sol";

interface ICollateralUnlockerErrors {
    error TooManyBalanceTokens();
    error InvalidBalanceTokenAddress(uint256 index);
    error TooManyBalanceTokenDecimals(uint256 index);
    error BalanceTokenDataOverride(uint256 index);
    error BalanceTokenNotSupported(address token);
    error InsufficientTokenBalance(address token, address account, uint256 balance, uint256 amount);
    error WithdrawRefusal();
    error InvalidWithdrawSkip();
    error UnauthorizedUnlockAccess(address account);
}

interface ICollateralUnlockerEvents {
    event Deposit(address account, address token, uint256 amount, uint256 lockChain);
    event Withdraw(address account, address token, uint256 amount, uint256 lockChain);
    event UnlockReport(bytes32 indexed reportHash);
}

interface ICollateralUnlockerViews {
    function DECIMALS() external view returns (uint8);

    function TOTAL_BALANCE_TOKENS() external view returns (uint256);

    function balance(address account, uint256 lockChain) external view returns (uint256);

    function balanceByToken(address account, uint256 lockChain, address token) external view returns (uint256);

    function isBalanceToken(address token) external view returns (bool);

    function balanceTokenIndex(address token) external view returns (uint256);

    function balanceTokenDecimals(address token) external view returns (uint8);

    function balanceTokenByIndex(uint256 tokenIndex) external view returns (address);

    function unlockCounter(address account, uint256 lockChain) external view returns (uint256);

    function unlockWithdrawNonce(address account, uint256 lockChain) external view returns (uint256);
}

interface ICollateralUnlocker is ICollateralUnlockerErrors, ICollateralUnlockerEvents, ICollateralUnlockerViews {
    function deposit(address token, uint256 tokenAmount, uint256 lockChain) external;

    function withdraw(address token, uint256 amount, uint256 lockChain, uint256 lockCounter, bytes calldata reportProof) external;

    function skipWithdraw(uint256 lockChain, uint256 firstNonce, uint256 lastNonce) external;

    function approveUnlock(address account, uint256 amount, uint256 lockChain) external;

    function rejectUnlock(address account, uint256 amount, uint256 lockChain, address receiver) external;

    function reportUnlockCounterUpdate(address account, uint256 lockChain) external;
}
