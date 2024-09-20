// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ICollateralLocker} from "./ICollateralLocker.sol";
import {ICollateralConfig} from "./ICollateralConfig.sol";

interface ICollateralBastion is ICollateralLocker, ICollateralConfig {}
