pragma solidity ^0.8.0;


/**
 * @title PoolFactory Interface
 */
abstract contract IPoolFactory {
    function deploy
    (
        uint maxBalance,
        uint minContribution,
        uint maxContribution,
        uint ctorFeePerEther,
        address creatorAddress,
        address presaleAddress,
        address feeManagerAddr,
        address[] calldata whitelist,
        address[] calldata adminis
    )
        virtual external
        returns (address poolAddress, uint poolVersion);
}