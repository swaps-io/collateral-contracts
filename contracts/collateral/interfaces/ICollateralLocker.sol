// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IProofVerifier} from "../../proof/interfaces/IProofVerifier.sol";

import {IAccessWhitelist} from "../../whitelist/interfaces/IAccessWhitelist.sol";

interface ICollateralLockerErrors {
    error LockRefusal();
    error InvalidUnlockUpdate();
    error UnauthorizedLockAccess(address account);
}

interface ICollateralLockerEvents {
    event WithdrawReport(bytes32 indexed reportHash);
}

interface ICollateralLockerViews {
    function lockCounter(address account, uint256 unlockChain) external view returns (uint256);

    function lockWithdrawNonce(address account, uint256 unlockChain) external view returns (uint256);

    function externalUnlockCounter(address account, uint256 unlockChain) external view returns (uint256);
}

interface ICollateralLocker is ICollateralLockerErrors, ICollateralLockerEvents, ICollateralLockerViews {
    function reportWithdraw(uint256 amount, uint256 unlockChain) external;

    function commitLock(address account, uint256 amount, uint256 unlockChain, uint256 unlockCounter) external;

    function cancelLock(address account, uint256 amount, uint256 unlockChain) external;

    function updateUnlockCounter(address account, uint256 unlockChain, uint256 unlockCounter, bytes calldata reportProof) external;
}
