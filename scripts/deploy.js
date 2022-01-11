require("dotenv").config();
const fetch = require('node-fetch');
const hre = require("hardhat");

const API_URL = 'http://127.0.0.1:3000/api/v1'
// const API_URL = 'https://app.cryptoexcellence.xyz/api/v1/'
const CE_IDO_BY_ID = API_URL+'/idos?idoid=';
const CE_LOTTERY_BY_IDO_ID = API_URL+'/lottery/ido?idoid=';

async function fetchAPI(endpoint, method = 'GET', payload = null) {
    const options = {
        method
    }
    options.mode = 'cors'
    options.credentials = 'include'
    options.headers =  {
        'Authorization': process.env.REACT_APP_API_KEY,
        'Content-Type': 'application/json'
    }
    if (payload) {
        options.body = JSON.stringify(payload)
    }

    return fetch(endpoint,
        options
    ).then(
        response => response.json()
    ).catch(
        error => console.error(error)
    )
}

const getIdoById = async(idoid) => {
    try {
        const IdoData = await fetchAPI(`${CE_IDO_BY_ID}`+idoid)
        return IdoData
    } catch(e) {
        console.log(e)
    }
    return {}
}

const getLotteryResultsByIdoId = async(idoid) => {
    try {
        const IdoData = await fetchAPI(`${CE_LOTTERY_BY_IDO_ID}`+idoid)
        return IdoData
    } catch (e) {
        console.log(e)
    }
    return {}
}

async function main() {

    //await hre.run("compile");

    let idoid = process.env.IDO_ID;
    console.log("Deploying Contract for ido "+idoid);
    const idoData = await getIdoById(idoid);
    console.log(idoData)
    const lotData = await getLotteryResultsByIdoId(idoid);
    const winners = [];
    let cntr = 0;
    for (let i = 0; i < lotData.length; i++) {
        if (lotData[i]['result'] === 'win') {
            winners[cntr] = lotData[i]['address'];
            cntr++;
        }
    }

    const [deployer, addr1] = await hre.ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    console.log("# Of Whitelisted Addresses being added:", winners.length);

    const IdoPool = await hre.ethers.getContractFactory("IdoPool");

    //const latestTime = await web3.eth.getBlock('latest');
    const startTime = idoData.dtstart;
    const endTime = idoData.dtend;
    const weiMinCont = hre.ethers.utils.parseEther(parseFloat(idoData.min_cb).toString());
    const weiMaxCont = hre.ethers.utils.parseEther(parseFloat(idoData.max_cb).toString());
    const cap = hre.ethers.utils.parseEther(parseFloat(idoData.poolcap).toString());
    const wallet = addr1.address;
    const admin = deployer;

    console.log("Pool Wallet: ", wallet);

    const idopool = await IdoPool.deploy(
        startTime,
        endTime,
        wallet,
        weiMaxCont,
        weiMinCont,
        cap,
        admin.address
    );

    console.log("IDO Pool address:", idopool.address);

    await idopool.addWhitelisted(
        admin.address,
        {from:admin.address}
    )

    /* TODO: Sometimes these fail due to gas, fix
    for (let i = 0; i < winners.length; i++) {
        try {
            await idopool.addWhitelisted(
                winners[i],
                {from:admin.address}
            )
        } catch (e) {
            console.log('error adding to whitelist:',winners[i]);
            console.log(e);
        }
    }
    */

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });