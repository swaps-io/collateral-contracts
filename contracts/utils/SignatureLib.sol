// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

library SignatureLib {
    // Based on OpenZeppelin library (v5.0.2) internal implementation. See "ECDSA.sol"
    function unpackVs(bytes32 vs_) internal pure returns (bytes32 s, uint8 v) {
        unchecked {
            s = vs_ & bytes32(0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff);
            v = uint8((uint256(vs_) >> 255) + 27);
        }
    }
}
