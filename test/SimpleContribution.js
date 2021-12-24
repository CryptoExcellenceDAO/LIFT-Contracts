const { expect } = require("chai");

describe("Simple IDO Contribution", function () {

    const duration = {
        seconds: function(val) {
            return val
        },
        minutes: function(val) {
            return val * this.seconds(60)
        },
        hours: function(val) {
            return val * this.minutes(60)
        },
        days: function(val) {
            return val * this.hours(24)
        },
        weeks: function(val) {
            return val * this.days(7)
        },
        years: function(val) {
            return val * this.days(365)
        }
    };

    function advanceBlock() {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_mine',
                id: Date.now(),
            }, (err, res) => {
                return err ? reject(err) : resolve(res)
            })
        })
    }

    let latestTime;

    before(async function() {
        latestTime = await web3.eth.getBlock('latest');
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    beforeEach(async function() {
        const [owner, addr1, addr2] = await ethers.getSigners();
        this.startTime = latestTime.timestamp + duration.weeks(1);
        this.endTime = this.startTime + duration.weeks(1);
        this.afterEndTime = this.endTime + duration.seconds(1);
        this.weiMinCont = ethers.utils.parseEther("1.0")
        this.weiMaxCont = ethers.utils.parseEther("20.0")
        this.wallet = addr2.address; //const [owner, addr1, addr2] = await ethers.getSigners();//"0xB1755eE34fc33fff8a5E5B16A0C9C74363cFA0f4" replace for advance testing
        this.investor = addr1;
        const SimpleCont = await ethers.getContractFactory("SimpleContribution");
        this.idopool = await SimpleCont.deploy(
            this.startTime,
            this.endTime,
            this.wallet,
            this.weiMaxCont,
            this.weiMinCont,
        );
        await this.idopool.deployed();
        //console.log('IDO Pool Smart Contract deployed =', this.idopool.address);
        this.p_start = await web3.eth.getBalance(addr1.address);
        this.w_start = await web3.eth.getBalance(addr2.address);
        this.c_start = await web3.eth.getBalance(this.idopool.address);
        this.contribution = ethers.utils.parseEther("10.0")
    });

    describe('Accepting Payments', function() {
        it('should reject contributions that are too small', async function() {
            const txhash = await this.investor.sendTransaction({
                to: this.wallet,
                value: ethers.utils.parseEther("0.5")
            });
            console.log(txhash);
        });
        it('should reject contributions that are too big', async function() {
            const txhash = await this.investor.sendTransaction({
                to: this.wallet,
                value: ethers.utils.parseEther("21.0")
            });
            console.log(txhash);
        });
    });

    describe("Contribution Process", function () {
        it("should forward contribution to wallet", async function () {

            const txhash = await this.investor.sendTransaction({
                to: this.wallet,
                value: this.contribution
            });

            const w_end = await web3.eth.getBalance(this.wallet);
            const c_end = await web3.eth.getBalance(this.idopool.address);

            // contribution went to wallet
            expect((w_end - this.w_start) == (this.contribution));
            // contirbution not in smart contract address, which has nothing
            expect((c_end == this.c_start == 0));
        });
    });

    describe("Contribution Costs", function () {
        it("should cost investor their contribution value + gas", async function () {

            const txhash = await this.investor.sendTransaction({
                to: this.wallet,
                value: this.contribution
            });

            const receipt = await web3.eth.getTransactionReceipt(txhash.hash)
            const p_end = await web3.eth.getBalance(this.investor.address);

            const gas_used = web3.utils.toBN(receipt.gasUsed);
            const gas_price = web3.utils.toBN(txhash.gasPrice);
            const part_end = web3.utils.toBN(p_end);

            expect((part_end.add(gas_used.mul(gas_price))) == (this.p_start-this.contribution));
        });
    });

});