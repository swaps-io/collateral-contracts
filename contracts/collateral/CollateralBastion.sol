// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {ICollateralBastion} from "./interfaces/ICollateralBastion.sol";

import {CollateralLocker} from "./CollateralLocker.sol";
import {CollateralConfig} from "./CollateralConfig.sol";

contract CollateralBastion is ICollateralBastion, CollateralLocker, CollateralConfig, Multicall {
    // prettier-ignore
    constructor(uint256 variant_, address proofVerifier_, address accessWhitelist_)
        CollateralConfig(variant_, proofVerifier_, accessWhitelist_)
        CollateralLocker(variant_, proofVerifier_, accessWhitelist_) {}
}
