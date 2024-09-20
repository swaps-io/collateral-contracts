// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

struct TokenPermissions {
    address token;
    uint256 amount;
}

struct PermitTransferFrom {
    TokenPermissions permitted;
    uint256 nonce;
    uint256 deadline;
}

struct SignatureTransferDetails {
    address to;
    uint256 requestedAmount;
}

interface IPermit2 {
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}
