require("dotenv").config();
const fetch = require('node-fetch');
const hre = require("hardhat");

//const API_URL = 'http://127.0.0.1:3000/api/v1'
const API_URL = 'https://app.cryptoexcellence.xyz/api/v1'
const CE_IDO_BY_ID = API_URL+'/idos?idoid=';
const CE_LOTTERY_BY_IDO_ID = API_URL+'/lottery/ido?idoid=';
const CE_UPDATE_IDO_BY_ID = API_URL+'/idos/update/';

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

    let idoid = undefined;
    if (process.argv[2] && process.argv[2] === "--ido_id" && process.argv[3]) {
        idoid = process.argv[3];
    }

    if (idoid === undefined) {
        throw TypeError("ido id must be defined");
    }

    //let idoid = process.env.IDO_ID;
    const idoData = await getIdoById(idoid);
    console.log(idoData,"\n");
    console.log("Deploying Contract for Ido "+idoid);

    if (idoData.contract_address) {
        console.log("Warning: Ido contract already exists");
    } else {
        console.log("Creating new contract for Ido");
    }

    const lotData = await getLotteryResultsByIdoId(idoid);
    const winners = [];
    let cntr = 0;
    for (let i = 0; i < lotData.length; i++) {
        if (lotData[i]['result'] === 'win') {
            winners[cntr] = lotData[i]['address'];
            cntr++;
        }
    }

    await hre.run("compile");

    const [deployer] = await hre.ethers.getSigners();

    console.log("Deploying Ido Pool contract with the account:", deployer.address);
    //console.log("Account balance:", (await deployer.getBalance()).toString());
    console.log("# Of Whitelisted Addresses being added:", winners.length);

    const IdoPool = await hre.ethers.getContractFactory("IdoPool");

    //const latestTime = await web3.eth.getBlock('latest');
    const startTime = idoData.dtstart;
    const endTime = idoData.dtend;
    const weiMinCont = hre.ethers.utils.parseEther(parseFloat(idoData.min_cb).toString());
    const weiMaxCont = hre.ethers.utils.parseEther(parseFloat(idoData.max_cb).toString());
    const cap = hre.ethers.utils.parseEther(parseFloat(idoData.poolcap).toString());

    const wallet = process.env.POOL_WALLET;
    const admin = deployer;
    const usdtContract = "0x946ca9f234c2d6d5d3e5bd805742dcf7637f38e7"; // this was from toktest deployment

    console.log("Pool Wallet: ", wallet);

    const idopool = await IdoPool.deploy(
        startTime,
        endTime,
        wallet,
        weiMaxCont,
        weiMinCont,
        cap,
        admin.address,
        usdtContract
    );

    console.log("Ido Pool address:", idopool.address);

    whitelisted = winners;
    whitelisted.push(admin.address); // include admin address
    whitelisted.push("0x94C4C1b0d9D6569a181811ec3D1B3c96DABFc494"); // include another admin address for now

    await idopool.addWhitelisted(
        whitelisted,
        {from:admin.address}
    )

    const UpdatedIdoData = await fetchAPI(
        `${CE_UPDATE_IDO_BY_ID}`+idoid,
        'PUT',
        {
            dtstart: idoData.dtstart,
            dtend: idoData.dtend,
            min_cb: idoData.min_cb,
            max_cb: idoData.max_cb,
            poolcap: idoData.poolcap,
            progress: idoData.progress,
            num_participants: idoData.num_participants,
            contract_address: idopool.address
        }
    )

    console.log("Ido Updated");

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });