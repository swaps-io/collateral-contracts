// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IApproveAccessWhitelist} from "./IApproveAccessWhitelist.sol";

interface IApproveAccessWhitelistOwned is IApproveAccessWhitelist {
    function approveProtocol(address protocol, bool allowance) external;
}
