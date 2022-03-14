require("dotenv").config();
const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("==================================");
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("Deploying Staking contract with the account:", deployer.address);

    //const blockNum = await web3.eth.getBlockNumber();
    //const latestBlock = await hre.ethers.provider.getBlock("latest")

    const ceTokenAddr = process.env.CE_TOKEN_ADDR;
    const startTime = process.env.STAKING_START_TIME;
    const endTime = process.env.STAKING_END_TIME;

    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(
        ceTokenAddr,
        startTime,
        endTime
    );

    const lpAddr = process.env.LP_PAIR_ADDR;

    console.log("Deploying xCE contract with the account:", deployer.address);

    const TokName = "xCrypto Excellence";
    const TokSym = "xCE";
    const StakingContract = staking.address;

    const XCE = await hre.ethers.getContractFactory("XCe");
    const xCe = await XCE.deploy(
        TokName,
        TokSym,
        StakingContract
    );

    console.log("==================================");
    console.log("Staking address:", StakingContract);
    console.log("LP address:", lpAddr);
    console.log("CE address:", ceTokenAddr);
    console.log("xCE address:", xCe.address);
    console.log("==================================");

    console.log("Starting time lock");

    await staking.addTimeLock(
        lpAddr
    );

    console.log("Time lock started")
    console.log("After 48 hours, add the lp pool");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });