require("dotenv").config();
const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("==================================");
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("Adding LP to Staking contract with the account:", deployer.address);

    const stakingAddr = "0xf8Bb91817A960C3e23AE8ae75dE1C070Faee0823".toLowerCase();
    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await Staking.attach(stakingAddr);

    const allocPoint = 1;
    const lpAddr = process.env.LP_PAIR_ADDR;
    const xCeAddr = "0x879374796e4575a903BAFC82e3fD18E4fd59DE80".toLowerCase();

    await staking.add(
        allocPoint,
        lpAddr,
        xCeAddr
    )

    console.log("LP pool added!");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });