# LIFT Contracts

## Summary

Smart Contracts for creating and automating IDO investment pools.

Pools have a start and end timestamps, along with minimum and maximum contribution amounts. Investors can contribute to IDO pools to receive future tokens based on a rate set in USDT, USDC, or alternatives. Funds collected are forwarded to a wallet as they arrive.

To run tests:

```bash
npx hardhat test
```

To compile:

```bash
npx hardhat compile
```

## Packages

First install Hardhat, and node, npm if you don't have them.

Then:

```bash
npm install --save-dev @nomiclabs/hardhat-ethers ethers
npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle
npm install --save-dev @nomiclabs/hardhat-web3 web3
npm install --save-dev chai
```

## Testing Output:

```bash
  Simple IDO Contribution
    Accepting Payments
      ✓ should reject contributions that are too small
      ✓ should reject contributions that are too big
    Contribution Process
      ✓ should forward contribution to wallet
    Contribution Costs
BigNumber.toString does not accept any parameters; base-10 is assumed
      ✓ should cost investor their contribution value + gas


  4 passing (1s)
```