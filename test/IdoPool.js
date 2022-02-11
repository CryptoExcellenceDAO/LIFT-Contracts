const { artifacts } = require("hardhat");

const BigNumber = web3.BigNumber;
const should = require("chai")
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const IdoPool = artifacts.require("IdoPool");
const TokTest = artifacts.require("TokTest");

describe("IDO Pool", function () {

    // Increases testrpc time by the passed duration in seconds
    function increaseTime(duration) {
        const id = Date.now()

        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [duration],
                id: id,
            }, err1 => {
                if (err1) return reject(err1)

                web3.currentProvider.send({
                    jsonrpc: '2.0',
                    method: 'evm_mine',
                    id: id + 1,
                }, (err2, res) => {
                    return err2 ? reject(err2) : resolve(res)
                })
            })
        })
    }

    /**
     * Beware that due to the need of calling two separate testrpc methods and rpc calls overhead
     * it's hard to increase time precisely to a target point so design your test to tolerate
     * small fluctuations from time to time.
     *
     * @param target time in seconds
     */
    function increaseTimeTo(target, now) {
        if (target < now) throw Error(`Cannot increase current time(${now}) to a moment in the past(${target})`);
        let diff = target - now;
        return increaseTime(diff);
    }

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
        //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
        await advanceBlock();
    });

    beforeEach(async function() {

        latestTime = await web3.eth.getBlock('latest');

        const [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();

        this.wallet = addr1.address;
        this.investor = owner;
        this.investor2 = addr2;
        this.admin = addr3;
        this.investor3 = addr4;
        this.investor4 = addr5;

        this.startTime = latestTime.timestamp + duration.weeks(1);
        this.endTime = this.startTime + duration.weeks(1);
        this.afterEndTime = this.endTime + duration.seconds(1);

        this.weiMinCont = web3.utils.toBN('2'); //ethers.utils.parseEther("0.001")
        this.weiMaxCont = web3.utils.toBN('50'); //ethers.utils.parseEther("50.0")
        this.cap = web3.utils.toBN('100'); //ethers.utils.parseEther("100.0")

        this.smallerCont = web3.utils.toBN('1'); //ethers.utils.parseEther("0.0005")
        this.largerCont = web3.utils.toBN('51'); //ethers.utils.parseEther("50.1")

        const tokName = "Tether";
        const tokSym = "USDT";

        this.toktest = await TokTest.new(
            tokName,
            tokSym
        );

        this.idopool = await IdoPool.new(
            this.startTime,
            this.endTime,
            this.wallet,
            this.weiMaxCont,
            this.weiMinCont,
            this.cap,
            this.admin.address,
            this.toktest.address,
        );

        this.contribution = web3.utils.toBN('2') //ethers.utils.parseEther("0.0011")

        await this.idopool.addWhitelisted([this.investor.address], {
            from: this.admin.address
        });

        await this.idopool.addWhitelisted([this.investor2.address], {
            from: this.admin.address
        });

        let tokBal = await this.toktest.balanceOf(this.investor.address);
        //console.log('Deployer balance:',tokBal.toString());

        await this.toktest.transfer(this.admin.address, 1000);
        await this.toktest.transfer(this.investor2.address, 1000);
        await this.toktest.transfer(this.investor3.address, 1000);
        await this.toktest.transfer(this.investor4.address, 1000);

        tokBal = await this.toktest.balanceOf(this.admin.address);
        //console.log('investors balance:',tokBal.toString());

        await this.toktest.approve(this.idopool.address, 100000);

        //console.log('IDO Pool Smart Contract deployed =', this.idopool.address);
    });

    describe('Time and Cap Constraints', function() {

        /*it('should be ended when cap is reached', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            let ended = await this.idopool.hasEnded();
            ended.should.equal(false);
            await this.idopool.contribute(this.investor.address, this.weiMaxCont, {
                from: this.investor.address
            });
            await this.idopool.contribute(this.investor2.address, this.weiMaxCont, {
                from: this.investor2.address
            });
            ended = await this.idopool.hasEnded();
            ended.should.equal(true);
        });*/

        it('should be ended after end', async function() {
            let ended = await this.idopool.hasEnded();
            ended.should.equal(false);
            await increaseTimeTo(this.afterEndTime, latestTime.timestamp);
            ended = await this.idopool.hasEnded();
            ended.should.equal(true);
        });
    });

    describe('Accepting Contributions', function() {

        it('should reject contributions before start', async function() {
            await this.idopool.send(this.contribution).should.be.rejectedWith('revert');
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address,
            }).should.be.rejectedWith('revert');
        });

        it('should accept valid contributions after start', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            //await this.idopool.send(this.contribution).should.be.fulfilled;
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            }).should.be.fulfilled;
        });

        it('should reject contributions after end', async function() {
            await increaseTimeTo(this.afterEndTime, latestTime.timestamp);
            await this.idopool.send(this.contribution).should.be.rejectedWith('revert');
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            }).should.be.rejectedWith('revert');
        });
    });

    describe("Contribution Process", function () {

        it('should reject contributions that are too small', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            //await this.idopool.send(this.smallerCont).should.be.rejectedWith("Invalid Purchase");
            await this.idopool.contribute(this.investor.address, this.smallerCont, {
                from: this.investor.address
            }).should.be.rejectedWith("Invalid Purchase");
        });

        it('should reject contributions that are too big', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            //await this.idopool.send(this.largerCont).should.be.rejectedWith("Invalid Purchase");
            await this.idopool.contribute(this.investor.address, this.largerCont, {
                from: this.investor.address
            }).should.be.rejectedWith("Invalid Purchase");
        });

        it("should forward contribution to wallet - low level", async function () {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const w_start = await this.toktest.balanceOf(this.wallet);

            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            }).should.be.fulfilled;

            const w_end = await this.toktest.balanceOf(this.wallet);
            const c_end = await this.toktest.balanceOf(this.idopool.address);

            // contribution went to wallet
            w_end.sub(w_start).toString().should.be.equal(this.contribution.toString());
            // contribution not in smart contract address, which has nothing
            c_end.toString().should.be.equal('0');
        });

        it('should log contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const { logs } = await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });

            const event = logs.find(e => e.event === 'TokenContribution');
            const contBN = web3.utils.toBN(this.contribution);

            should.exist(event);
            event.args.purchaser.should.equal(this.investor.address);
            event.args.beneficiary.should.equal(this.investor.address);
            event.args.value.toString().should.be.equal(contBN.toString());
        });
    });

    describe("Contract Data Objects", function() {
        it('should update total contributors - one address, multiple contributions', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            const contributors =  web3.utils.toBN(1); // same contributor, sent funds twice (total still under individual max cap)
            const total_contributors = await this.idopool.getTotalContributors();
            contributors.toString().should.be.equal(total_contributors.toString());
        });

        /*it('should update total contributors - multiple address, multiple contributions', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            await this.idopool.contribute(this.investor2.address, this.contribution, {
                from: this.investor2.address
            });
            const contributors =  web3.utils.toBN(2);
            const total_contributors = await this.idopool.getTotalContributors();
            contributors.toString().should.be.equal(total_contributors.toString());
        });*/

        it('should reject last txn before individual total contribution overflow', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            await this.idopool.contribute(this.investor.address, this.weiMaxCont, {
                from: this.investor.address
            }).should.be.rejectedWith('revert');
        });

        it('should update wei raised with valid contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const { logs } = await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });

            const wei_raised = await this.idopool.getWeiRaised();
            const contBN = web3.utils.toBN(this.contribution);
            wei_raised.toString().should.be.equal(contBN.toString());
        });

        it('should not update wei raised with invalid contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            const wei_raised1 = await this.idopool.getWeiRaised();
            await this.idopool.contribute(this.investor.address, this.weiMaxCont, {
                from: this.investor.address
            }).should.be.rejectedWith('revert');
            const wei_raised2 = await this.idopool.getWeiRaised();
            wei_raised1.toString().should.be.equal(wei_raised2.toString());
        });

        it('should not update total contributors with invalid contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            const tot_cont1 = await this.idopool.getTotalContributors();
            await this.idopool.contribute(this.investor.address, this.weiMaxCont, {
                from: this.investor.address
            }).should.be.rejectedWith('revert');
            const tot_cont2 = await this.idopool.getTotalContributors();
            tot_cont1.toString().should.be.equal(tot_cont2.toString());
        });

    });

    describe("WhiteList Logic", function () {
        it("should allow adding whitelisted address from admin", async function () {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.addWhitelisted([this.investor3.address], {
                from: this.admin.address
            }).should.be.fulfilled;
        });
        it("should reject adding whitelisted address from non-admin", async function () {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.addWhitelisted([this.investor3.address], {
                from: this.investor2.address
            }).should.be.rejectedWith('revert');
            await this.idopool.addWhitelisted([this.investor3.address], {
                from: this.investor3.address
            }).should.be.rejectedWith('revert');
        });
        it('should reject contributions from non-whitelisted address', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor4.address, this.contribution, {
                from: this.investor4.address
            }).should.be.rejectedWith("Invalid Purchase");
        });
        it('should accept contributions from whitelisted address', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            }).should.be.fulfilled;
        });
    });

    describe("Contribution Costs", function () {
        //it("should cost investor their contribution value + gas", async function () {
        it("should cost investor their contribution value", async function () {

            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const p_start = await this.toktest.balanceOf(this.investor.address);

            const logs = await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            }).should.be.fulfilled;

            const p_end = await this.toktest.balanceOf(this.investor.address);

            const gas_used = web3.utils.toBN(logs.receipt.gasUsed);
            const gas_price = web3.utils.toBN(logs.receipt.effectiveGasPrice);

            // investor ending balance + (gas used * gas price) = investor starting balance - contribution
            //p_end.add(gas_used.mul(gas_price)).toString().should.be.equal(p_start.sub(this.contribution).toString());
            p_end.toString().should.be.equal(p_start.sub(this.contribution).toString());
        });

        /*it("should forward contribution to wallet - high level", async function () {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const w_start = await this.toktest.balanceOf(this.wallet);
            await this.idopool.sendTransaction(this.investor.address, this.contribution, {
                from: this.investor.address
            });
            const w_end = await this.toktest.balanceOf(this.wallet);
            const c_end = await this.toktest.balanceOf(this.idopool.address);

            // contribution went to wallet
            w_end.sub(w_start).toString().should.be.equal(this.contribution.toString());
            // contribution not in smart contract address, which has nothing
            c_end.toString().should.be.equal('0');
        });*/

        it('should log contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const { logs } = await this.idopool.contribute(this.investor.address, this.contribution, {
                from: this.investor.address
            });

            const event = logs.find(e => e.event === 'TokenContribution');
            const contBN = web3.utils.toBN(this.contribution);

            should.exist(event);
            event.args.purchaser.should.equal(this.investor.address);
            event.args.beneficiary.should.equal(this.investor.address);
            event.args.value.toString().should.be.equal(contBN.toString());
        });

    });

});