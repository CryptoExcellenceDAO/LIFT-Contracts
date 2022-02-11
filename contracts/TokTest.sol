// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./openzeppelin/ERC20.sol";

contract TokTest is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        // Mint tokens to msg.sender
        _mint(msg.sender, 100000 * 10**uint(decimals()));
    }
}
