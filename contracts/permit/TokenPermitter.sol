// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {SignatureLib} from "../utils/SignatureLib.sol";

import {IDaiPermit} from "./interfaces/IDaiPermit.sol";
import {ITokenPermitter} from "./interfaces/ITokenPermitter.sol";
import {PERMIT2, IPermit2, PermitTransferFrom, TokenPermissions, SignatureTransferDetails} from "./interfaces/IPermit2.sol";

abstract contract TokenPermitter is ITokenPermitter {
    function permit(address from_, address token_, uint256 amount_, uint256 deadline_, bytes32 r_, bytes32 vs_) external {
        (bytes32 s, uint8 v) = SignatureLib.unpackVs(vs_);
        // solhint-disable-next-line no-empty-blocks
        try IERC20Permit(token_).permit(from_, address(this), amount_, deadline_, v, r_, s) {} catch {}
    }

    function permitDai(address from_, address token_, bool allowed_, uint256 deadline_, bytes32 r_, bytes32 vs_) external {
        uint256 nonce = IDaiPermit(token_).nonces(from_);
        (bytes32 s, uint8 v) = SignatureLib.unpackVs(vs_);
        // solhint-disable-next-line no-empty-blocks
        try IDaiPermit(token_).permit(from_, address(this), nonce, deadline_, allowed_, v, r_, s) {} catch {}
    }

    function permitUniswap(address from_, address token_, uint256 amount_, uint256 deadline_, bytes calldata signature_) external {
        uint256 nonce = uint256(keccak256(abi.encodePacked(token_, from_, amount_, deadline_, address(this))));
        IPermit2(PERMIT2).permitTransferFrom(
            PermitTransferFrom({permitted: TokenPermissions({token: token_, amount: amount_}), nonce: nonce, deadline: deadline_}),
            SignatureTransferDetails({to: address(this), requestedAmount: amount_}),
            from_,
            signature_
        );
    }
}
