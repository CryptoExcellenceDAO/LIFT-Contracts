# LIFT Contracts

## Current Testing Contract:

https://rinkeby.etherscan.io/address/0x064F817b139Cf80Ec1297799854A78FDA250A718

## Summary

Smart Contracts for creating and automating IDO investment pools.

Pools have a start and end timestamps, along with minimum and maximum contribution amounts. Investors can contribute to IDO pools to receive future tokens based on a rate set in USDT, USDC, or alternatives. Funds collected are forwarded to a wallet as they arrive.

To run tests:

```bash
# on hardhat
npx hardhat test
# on remote network
npx hardhat test --network <NETWORK_NAME>
```

To compile:

```bash
npx hardhat compile
```

To deploy:

```bash
npx hardhat run scripts/deploy.js --network <NETWORK_NAME>
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
npm install --save-dev node-fetch@2.0
```

## Testing Output (hardhat):

```bash
  IDO Pool
    Time and Cap Constraints
      ✓ should be ended when cap is reached
      ✓ should be ended after end
    Accepting Contributions
      ✓ should reject contributions before start
      ✓ should accept valid contributions after start
      ✓ should reject contributions after end
    Contribution Process
      ✓ should reject contributions that are too small
      ✓ should reject contributions that are too big
      ✓ should forward contribution to wallet - low level
      ✓ should log contribution
    Contribution Costs
      ✓ should cost investor their contribution value + gas
      ✓ should forward contribution to wallet - high level
      ✓ should log contribution


  12 passing (2s)
```