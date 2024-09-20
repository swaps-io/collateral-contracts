// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {IApproveAccessWhitelist} from "./interfaces/IApproveAccessWhitelist.sol";

abstract contract ApproveAccessWhitelist is IApproveAccessWhitelist, Multicall {
    mapping(address protocol => bool) public protocolAllowance;
    mapping(address account => mapping(address protocol => Allowance)) public allowance;

    function approve(address protocol_, Allowance allowance_) external {
        Allowance currentAllowance = allowance[msg.sender][protocol_];
        if (currentAllowance == allowance_) revert SameAllowance();

        if (currentAllowance == Allowance.Revoked) {
            // Transition from revoked to any approved mode requires protocol to be approved
            if (!protocolAllowance[protocol_]) revert ProtocolNotApproved();
        } else {
            // Complete revoke is not allowed once approve is given.
            // Can only switch between weak/strong approve modes afterwards
            if (allowance_ == Allowance.Revoked) revert RevokeNotAllowed();
        }

        allowance[msg.sender][protocol_] = allowance_;
        emit Approval(msg.sender, protocol_, allowance_);
    }

    function isApproved(address account_, address protocol_) public view returns (bool) {
        Allowance accountAllowance = allowance[account_][protocol_];
        if (accountAllowance == Allowance.ApprovedStrong) return true;
        return accountAllowance == Allowance.ApprovedWeak && protocolAllowance[protocol_];
    }

    function _approveProtocol(address protocol_, bool allowance_) internal {
        if (protocolAllowance[protocol_] == allowance_) revert SameProtocolAllowance();

        protocolAllowance[protocol_] = allowance_;
        emit ProtocolApproval(protocol_, allowance_);
    }
}
