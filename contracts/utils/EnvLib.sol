// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

// prettier-ignore
library EnvLib {
    function thisChain() internal view returns (uint256) { return block.chainid; }
}
