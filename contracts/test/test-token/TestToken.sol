// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {ERC20Permit, ERC20} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract TestToken is ERC20Permit {
    string private constant NAME = "Generic Test";
    string private constant SYMBOL = "GENT";

    constructor() ERC20(NAME, SYMBOL) ERC20Permit(NAME) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account_, uint256 amount_) external virtual {
        _mint(account_, amount_);
    }
}
