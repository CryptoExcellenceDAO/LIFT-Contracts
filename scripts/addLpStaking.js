require("dotenv").config();
const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("==================================");
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("Adding LP to Staking contract with the account:", deployer.address);

    const stakingAddr = "0x960459d48677EBEcCe2DF6f599669D845690ab7F";
    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await Staking.attach(stakingAddr);

    const allocPoint = 1;
    const lpAddr = process.env.LP_PAIR_ADDR;
    const xCeAddr = "0xE1Fd495ED3AF084984658b259991b87Bc74050f5";

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