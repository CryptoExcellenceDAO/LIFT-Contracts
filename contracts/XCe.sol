// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./openzeppelin/ERC20.sol";

contract XCe is ERC20 {

    address private transferAdmin;

    constructor(
        string memory name,
        string memory symbol,
        address _transferAdmin
    ) ERC20(name, symbol) {
        // set transfer admin (staking contract)
        transferAdmin = _transferAdmin;
        // Mint tokens to transfer admin (staking contract)
        _mint(_transferAdmin, 100000 * 10**uint(decimals()));
    }

    /**
     * @dev internal virtual override for any token transfers
     * require statements to revert state when conditions are not met
     * @param from the sender address
     * @param to the recipient address
     * @param amount the amount of token being transfered
     */
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal virtual override
    {
        super._beforeTokenTransfer(from, to, amount);

        require(_validRecipient(from, to), "ERC20WithSafeTransfer: invalid recipient or sender");
    }

    /**
     * @dev private view to check whether either recipient or sender are the transfer admin (staking contract)
     * @param from the sender address
     * @param to the recipient address
     * @return true if either recipient or sender are the transfer admin (staking contract)
     */
    function _validRecipient(address from, address to) private view returns (bool) {
        if (to == transferAdmin) {
            return true;
        } else if (from == transferAdmin) {
            return true;
        } else {
            return false;
        }
    }

    //...
}