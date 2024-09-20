// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IProofVerifier} from "../../proof/interfaces/IProofVerifier.sol";

import {IAccessWhitelist} from "../../whitelist/interfaces/IAccessWhitelist.sol";

interface ICollateralConfigViews {
    function VARIANT() external view returns (uint256);

    function PROOF_VERIFIER() external view returns (IProofVerifier);

    function ACCESS_WHITELIST() external view returns (IAccessWhitelist);
}

interface ICollateralConfig is ICollateralConfigViews {}
