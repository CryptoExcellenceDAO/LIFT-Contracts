require("dotenv").config();
const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("==================================");
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("Adding LP to Staking contract with the account:", deployer.address);

    const stakingAddr = "0xf0cd90fCf590486171642d7b050e1CA9D3904a13";
    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await Staking.attach(stakingAddr);

    const allocPoint = 1;
    const lpAddr = process.env.LP_PAIR_ADDR;
    const xCeAddr = "0xd24743FcCbf47b8e67B4E789C0e39EF692C2Adb6";

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