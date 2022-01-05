pragma solidity ^0.8.0;


/**
 * @title PoolRegistry Interface
 */
abstract contract IPoolRegistry {
    function register
    (
        address creatorAddress,
        address poolAddress,
        uint poolVersion,
        uint code
    )
        virtual external;
}
