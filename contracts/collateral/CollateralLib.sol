// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

library CollateralLib {
    // keccak256("WithdrawReport(bytes32)")
    bytes32 internal constant WITHDRAW_REPORT_SIG = 0x3321a689265433745b47ed94c03690fbe26997cda5466ac8a09e4435133f410d;

    // keccak256("UnlockReport(bytes32)")
    bytes32 internal constant UNLOCK_REPORT_SIG = 0xb66af513d3dbb1830e0b732fb480b637781c76849cfb48da2432c0ebd389abf7;

    // prettier-ignore
    function calcWithdrawReportHash(uint256 variant_, uint256 lockChain_, uint256 unlockChain_, address account_, uint256 lockCounter_, uint256 amount_, uint256 nonce_) internal pure returns (bytes32) {
        return keccak256(abi.encode(variant_, lockChain_, unlockChain_, account_, lockCounter_, amount_, nonce_));
    }

    // prettier-ignore
    function calcUnlockReportHash(uint256 variant_, uint256 unlockChain_, uint256 lockChain_, address account_, uint256 unlockCounter_) internal pure returns (bytes32) {
        return keccak256(abi.encode(variant_, unlockChain_, lockChain_, account_, unlockCounter_));
    }
}
