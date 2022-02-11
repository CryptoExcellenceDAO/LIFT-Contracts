const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("==================================");
    console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("Deploying Staking contract with the account:", deployer.address);

    //const blockNum = await web3.eth.getBlockNumber();
    //const latestBlock = await hre.ethers.provider.getBlock("latest")

    const ceTokenAddr = "0x1D8995b989CB51D7A438c0cF273eE26085b911D7";
    const rewardsPerBlock = 10000000;
    const startTime = 1643835781;
    const endTime = 2643835781;

    const Staking = await hre.ethers.getContractFactory("Staking");
    const staking = await Staking.deploy(
        ceTokenAddr,
        rewardsPerBlock,
        startTime,
        endTime
    );

    const allocPoint = 1;
    const lpAddr = "0x909b6b5fd50ff0a7b22f804062f4b33670a74d85";

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

    await staking.add(
        allocPoint,
        lpAddr,
        xCe.address
    )

    console.log("==================================");
    console.log("CE address:", ceTokenAddr);
    console.log("LP address:", lpAddr);
    console.log("Staking address:", staking.address);
    console.log("xCE address:", xCe.address);
    console.log("==================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });