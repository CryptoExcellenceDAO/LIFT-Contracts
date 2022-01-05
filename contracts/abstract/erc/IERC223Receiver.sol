pragma solidity ^0.8.0;


/**
 * @title ERC20 Interface
 */
abstract contract IERC20Base {
    function transfer(address to, uint value) virtual public returns (bool success);
    function balanceOf(address owner) virtual public view returns (uint balance);
}