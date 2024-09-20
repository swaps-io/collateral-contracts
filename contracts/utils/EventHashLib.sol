// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

library EventHashLib {
    function calcEventHash(bytes32 sig_, bytes32 arg_) internal pure returns (bytes32) {
        return keccak256(abi.encode(sig_, arg_));
    }
}
