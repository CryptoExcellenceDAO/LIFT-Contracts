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
npm install --save-dev @nomiclabs/hardhat-truffle5
npm install --save-dev chai
npm install --save-dev chai-as-promised
npm install --save-dev chai-bignumber
```

## Testing Output:

```bash
  Simple IDO Contribution
    Time and Cap Constraints
      ✓ should be ended when cap is reached
      ✓ should be ended after end time
    Accepting Contributions
      ✓ should reject contributions before start
      ✓ should accept valid contributions after start
      ✓ should reject contributions after end time
    Contribution Process
      ✓ should reject contributions that are too small
      ✓ should reject contributions that are too big
      ✓ should forward contribution to wallet
      ✓ should log contribution
    Contribution Costs
      ✓ should cost investor their contribution value + gas
      ✓ should log contribution

  11 passing (2s)
```