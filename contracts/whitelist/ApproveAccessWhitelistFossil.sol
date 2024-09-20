// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IApproveAccessWhitelistFossil} from "./interfaces/IApproveAccessWhitelistFossil.sol";

import {ApproveAccessWhitelist} from "./ApproveAccessWhitelist.sol";

contract ApproveAccessWhitelistFossil is IApproveAccessWhitelistFossil, ApproveAccessWhitelist {
    constructor(address[] memory approvedProtocols_) {
        for (uint256 i = 0; i < approvedProtocols_.length; i++) _approveProtocol(approvedProtocols_[i], true);
    }
}
