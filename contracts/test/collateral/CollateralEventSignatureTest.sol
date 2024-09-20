// SPDX-License-Identifier: BUSL-1.1

// solhint-disable one-contract-per-file

pragma solidity 0.8.24;

import {CollateralLib} from "../../collateral/CollateralLib.sol";

abstract contract CollateralUnlockReportEventSignatureTest {
    error UnlockReportEventSignatureMismatch(bytes32 signature, bytes32 expectedSignature);

    bytes32 private constant UNLOCK_REPORT_SIG = keccak256("UnlockReport(bytes32)");

    function checkUnlockReportEventSignature() external pure {
        if (CollateralLib.UNLOCK_REPORT_SIG != UNLOCK_REPORT_SIG) {
            revert UnlockReportEventSignatureMismatch(CollateralLib.UNLOCK_REPORT_SIG, UNLOCK_REPORT_SIG);
        }
    }
}

abstract contract CollateralWithdrawReportEventSignatureTest {
    error WithdrawReportEventSignatureMismatch(bytes32 signature, bytes32 expectedSignature);

    bytes32 private constant WITHDRAW_REPORT_SIG = keccak256("WithdrawReport(bytes32)");

    function checkWithdrawReportEventSignature() external pure {
        if (CollateralLib.WITHDRAW_REPORT_SIG != WITHDRAW_REPORT_SIG) {
            revert WithdrawReportEventSignatureMismatch(CollateralLib.WITHDRAW_REPORT_SIG, WITHDRAW_REPORT_SIG);
        }
    }
}

// prettier-ignore
// solhint-disable-next-line no-empty-blocks
contract CollateralEventSignatureTest is CollateralUnlockReportEventSignatureTest, CollateralWithdrawReportEventSignatureTest {}
