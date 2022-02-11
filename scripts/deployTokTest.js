const hre = require("hardhat");

async function main() {

    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying Tok Test contract with the account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    const TokName = "Crypto Excellence"; //"Tether";
    const TokSym = "CE"; //"USDT";

    const TokTest = await hre.ethers.getContractFactory("TokTest");
    const toktest = await TokTest.deploy(
        TokName,
        TokSym
    );

    console.log("Tok Test address:", toktest.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });