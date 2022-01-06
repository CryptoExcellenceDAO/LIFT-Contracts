const hre = require("hardhat");

async function main() {
    const [deployer, addr1] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const IdoPool = await hre.ethers.getContractFactory("IdoPool");

    const latestTime = await web3.eth.getBlock('latest');
    const startTime = latestTime.timestamp + 60;
    const endTime = startTime + (startTime * 60 * 60 * 24);
    const weiMinCont = hre.ethers.utils.parseEther("1.0");
    const weiMaxCont = hre.ethers.utils.parseEther("50.0");
    const cap = hre.ethers.utils.parseEther("100.0");
    const wallet = addr1.address;

    console.log("Start Time:", startTime);
    console.log("Pool Wallet: ", wallet);

    const idopool = await IdoPool.deploy(
        startTime,
        endTime,
        wallet,
        weiMaxCont,
        weiMinCont,
        cap,
    );

    console.log("IDO Pool address:", idopool.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });