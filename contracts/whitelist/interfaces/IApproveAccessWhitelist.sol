// SPDX-License-Identifier: BUSL-1.1

// solhint-disable one-contract-per-file

pragma solidity 0.8.24;

import {IAccessWhitelist} from "./IAccessWhitelist.sol";

interface IApproveAccessWhitelistErrors {
    error SameProtocolAllowance();
    error SameAllowance();
    error ProtocolNotApproved();
    error RevokeNotAllowed();
}

interface IApproveAccessWhitelistEnums {
    enum Allowance {
        Revoked,
        ApprovedWeak, // Revokes when protocol is revoked by owner
        ApprovedStrong // Doesn't revoke when protocol is revoked by owner
    }
}

interface IApproveAccessWhitelistEvents is IApproveAccessWhitelistEnums {
    event ProtocolApproval(address protocol, bool allowance);
    event Approval(address account, address protocol, Allowance allowance);
}

interface IApproveAccessWhitelistViews is IApproveAccessWhitelistEnums {
    function protocolAllowance(address protocol) external view returns (bool);

    function allowance(address account, address protocol) external view returns (Allowance);
}

interface IApproveAccessWhitelist is IAccessWhitelist, IApproveAccessWhitelistErrors, IApproveAccessWhitelistEvents, IApproveAccessWhitelistViews {
    function approve(address protocol, Allowance allowance) external;
}
