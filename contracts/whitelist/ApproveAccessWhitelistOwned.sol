// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";

import {IApproveAccessWhitelistOwned} from "./interfaces/IApproveAccessWhitelistOwned.sol";

import {ApproveAccessWhitelist} from "./ApproveAccessWhitelist.sol";

contract ApproveAccessWhitelistOwned is IApproveAccessWhitelistOwned, ApproveAccessWhitelist, Ownable2Step {
    constructor(address initialOwner_) Ownable(initialOwner_) {}

    // prettier-ignore
    function approveProtocol(address protocol_, bool allowance_) external onlyOwner { _approveProtocol(protocol_, allowance_); }
}
