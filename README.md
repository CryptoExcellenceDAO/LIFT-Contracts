# LIFT Contracts

## Gitbook

https://crypto-excellence.gitbook.io/crypto-excellence-dao-documentation/

## Summary

Smart Contracts for creating and automating IDO investment pools.

Smart Contracts for staking, leveraging UniswapV2Pairs for specialized reward distribution based on derived token share from LP.

Pools have a start and end timestamps, along with minimum and maximum contribution amounts. Investors can contribute to IDO pools to receive future tokens based on a rate set in USDT, USDC, or alternatives. Funds collected are forwarded to a wallet as they arrive. More info on the intended functionality for pools and staking can be found in the gitbook documentation.

To run tests:

```bash
npx hardhat test --network <NETWORK_NAME>
```

To compile:

```bash
npx hardhat compile
```

To deploy Staking or other contracts:

```bash
npx hardhat run scripts/<SCRIPT_NAME>.js --network <NETWORK_NAME>
```

To deploy Ido Pools:

```bash
node scripts/deployIdoPool.js --ido_id <IDO_ID> # network is determined by env var
```

## Packages

First install node, npm

To install packages
```bash
# from inside directory
npm install
```

To install and save packages individually

```bash
# from inside directory
npm install --save-dev hardhat
npm install --save-dev @nomiclabs/hardhat-ethers ethers
npm install --save-dev @nomiclabs/hardhat-waffle ethereum-waffle
npm install --save-dev @nomiclabs/hardhat-web3 web3
npm install --save-dev @nomiclabs/hardhat-truffle5
npm install --save-dev chai
npm install --save-dev chai-as-promised
npm install --save-dev chai-bignumber
npm install --save-dev node-fetch@2.0
# and any others
```
