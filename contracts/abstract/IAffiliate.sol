pragma solidity ^0.8.0;


/**
 * @title Affiliate Interface
 */
abstract contract IAffiliate {
    function getSharePerEther(address subscriber) virtual external view returns(uint sharePerEther, bool success);
    function sendRevenueShare(address subscriber) virtual external payable;
}