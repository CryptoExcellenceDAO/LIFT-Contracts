const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying xCE contract with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const TokName = "xCrypto Excellence"; //"Tether";
    const TokSym = "xCE"; //"USDT";
    const StakingContract = "0x3c8f20731Ff22A14b7b09D1a7bF1baeA2e21e964";

    const XCE = await hre.ethers.getContractFactory("XCe");
    const xCe = await XCE.deploy(
        TokName,
        TokSym,
        StakingContract
    );

    console.log("xCE address:", xCe.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });