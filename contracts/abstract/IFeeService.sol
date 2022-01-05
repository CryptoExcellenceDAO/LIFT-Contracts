pragma solidity ^0.8.0;


/**
 * @title FeeService Interface
 */
abstract contract IFeeService {
    function getFeePerEther() virtual public view returns(uint);
    function sendFee(address feePayer) virtual external payable;
}
