// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IHashStorage} from "./interfaces/IHashStorage.sol";

abstract contract HashStorage is IHashStorage {
    mapping(bytes32 hash => bool) public hasHashStore;

    function _storeHash(bytes32 hash_) internal {
        hasHashStore[hash_] = true;
    }
}
