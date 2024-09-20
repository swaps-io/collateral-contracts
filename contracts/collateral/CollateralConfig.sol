// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ICollateralConfig, IProofVerifier, IAccessWhitelist} from "./interfaces/ICollateralConfig.sol";

abstract contract CollateralConfig is ICollateralConfig {
    uint256 public immutable VARIANT;
    IProofVerifier public immutable PROOF_VERIFIER;
    IAccessWhitelist public immutable ACCESS_WHITELIST;

    constructor(uint256 variant_, address proofVerifier_, address accessWhitelist_) {
        VARIANT = variant_;
        PROOF_VERIFIER = IProofVerifier(proofVerifier_);
        ACCESS_WHITELIST = IAccessWhitelist(accessWhitelist_);
    }
}
