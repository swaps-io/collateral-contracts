// SPDX-License-Identifier: BUSL-1.1

// solhint-disable one-contract-per-file, no-empty-blocks

pragma solidity 0.8.24;

interface IAccessWhitelistViews {
    function isApproved(address account, address protocol) external view returns (bool);
}

interface IAccessWhitelist is IAccessWhitelistViews {}
