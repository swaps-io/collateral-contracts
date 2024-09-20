// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

import {TokenPermitter} from "../permit/TokenPermitter.sol";

import {ICollateralManager} from "./interfaces/ICollateralManager.sol";

import {CollateralLocker} from "./CollateralLocker.sol";
import {CollateralUnlocker} from "./CollateralUnlocker.sol";
import {CollateralConfig} from "./CollateralConfig.sol";

contract CollateralManager is ICollateralManager, CollateralLocker, CollateralUnlocker, CollateralConfig, TokenPermitter, Multicall {
    // prettier-ignore
    constructor(uint8 decimals_, uint168[] memory balanceTokenData_, uint256 variant_, address proofVerifier_, address accessWhitelist_)
        CollateralLocker(variant_, proofVerifier_, accessWhitelist_)
        CollateralUnlocker(decimals_, balanceTokenData_, variant_, proofVerifier_, accessWhitelist_)
        CollateralConfig(variant_, proofVerifier_, accessWhitelist_) {}
}
