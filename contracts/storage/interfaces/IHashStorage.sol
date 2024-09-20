// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

interface IHashStorage {
    function hasHashStore(bytes32 hash) external view returns (bool);
}
