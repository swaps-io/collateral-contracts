// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {HashStorage} from "../storage/HashStorage.sol";

import {EnvLib} from "../utils/EnvLib.sol";
import {EventHashLib} from "../utils/EventHashLib.sol";

import {ICollateralLocker, IProofVerifier, IAccessWhitelist} from "./interfaces/ICollateralLocker.sol";

import {CollateralLib} from "./CollateralLib.sol";

abstract contract CollateralLocker is ICollateralLocker, HashStorage {
    uint256 private immutable _VARIANT;
    IProofVerifier private immutable _PROOF_VERIFIER;
    IAccessWhitelist private immutable _ACCESS_WHITELIST;

    mapping(address account => mapping(uint256 unlockChain => uint256)) public lockCounter;
    mapping(address account => mapping(uint256 unlockChain => uint256)) public lockWithdrawNonce;
    mapping(address account => mapping(uint256 unlockChain => uint256)) public externalUnlockCounter;

    // prettier-ignore
    constructor(uint256 variant_, address proofVerifier_, address accessWhitelist_) {
        _VARIANT = variant_;
        _PROOF_VERIFIER = IProofVerifier(proofVerifier_);
        _ACCESS_WHITELIST = IAccessWhitelist(accessWhitelist_);
    }

    modifier withLockAccess(address account_) {
        if (!_ACCESS_WHITELIST.isApproved(account_, msg.sender)) revert UnauthorizedLockAccess(msg.sender);
        _;
    }

    function reportWithdraw(uint256 amount_, uint256 unlockChain_) external {
        uint256 lockCount = lockCounter[msg.sender][unlockChain_] + amount_;
        lockCounter[msg.sender][unlockChain_] = lockCount;

        uint256 nonce = lockWithdrawNonce[msg.sender][unlockChain_];
        bytes32 reportHash = CollateralLib.calcWithdrawReportHash(_VARIANT, EnvLib.thisChain(), unlockChain_, msg.sender, lockCount, amount_, nonce);
        lockWithdrawNonce[msg.sender][unlockChain_] = nonce + 1;

        _storeHash(EventHashLib.calcEventHash(CollateralLib.WITHDRAW_REPORT_SIG, reportHash));

        emit WithdrawReport(reportHash);
    }

    function commitLock(address account_, uint256 amount_, uint256 unlockChain_, uint256 unlockCounter_) external withLockAccess(account_) {
        uint256 lockCount = lockCounter[account_][unlockChain_] + amount_;
        if (lockCount > unlockCounter_) revert LockRefusal();

        lockCounter[account_][unlockChain_] = lockCount;
    }

    function cancelLock(address account_, uint256 amount_, uint256 unlockChain_) external withLockAccess(account_) {
        lockCounter[account_][unlockChain_] -= amount_;
    }

    function updateUnlockCounter(address account_, uint256 unlockChain_, uint256 unlockCounter_, bytes calldata reportProof_) external {
        uint256 currentCount = externalUnlockCounter[account_][unlockChain_];
        if (unlockCounter_ <= currentCount) revert InvalidUnlockUpdate();

        bytes32 reportHash = CollateralLib.calcUnlockReportHash(_VARIANT, unlockChain_, EnvLib.thisChain(), account_, unlockCounter_);
        _PROOF_VERIFIER.verifyHashEventProof(CollateralLib.UNLOCK_REPORT_SIG, reportHash, unlockChain_, reportProof_);

        externalUnlockCounter[account_][unlockChain_] = unlockCounter_;
    }
}
