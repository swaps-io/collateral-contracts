// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

interface ITokenPermitter {
    function permit(address from, address token, uint256 amount, uint256 deadline, bytes32 r, bytes32 vs) external;

    function permitDai(address from, address token, bool allowed, uint256 deadline, bytes32 r, bytes32 vs) external;

    function permitUniswap(address from, address token, uint256 amount, uint256 deadline, bytes calldata signature) external;
}
