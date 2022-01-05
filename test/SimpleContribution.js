//import EVMThrow from './helpers/EVMThrow';

const BigNumber = web3.BigNumber;
const should = require("chai")
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const SimpleContribution = artifacts.require("SimpleContribution");

describe("Simple IDO Contribution", function () {

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

        const [owner, addr1, addr2] = await ethers.getSigners();
        this.wallet = addr2.address;
        this.investor = addr1;

        this.startTime = latestTime.timestamp + duration.weeks(1);
        this.endTime = this.startTime + duration.weeks(1);
        this.afterEndTime = this.endTime + duration.seconds(1);

        this.weiMinCont = ethers.utils.parseEther("1.0")
        this.weiMaxCont = ethers.utils.parseEther("50.0")
        this.cap = ethers.utils.parseEther("100.0")

        this.smallerCont = ethers.utils.parseEther("0.5")
        this.largerCont = ethers.utils.parseEther("51.0")

        this.idopool = await SimpleContribution.new(
            this.startTime,
            this.endTime,
            this.wallet,
            this.weiMaxCont,
            this.weiMinCont,
            this.cap,
        );

        this.contribution = ethers.utils.parseEther("10.0")

        //console.log('IDO Pool Smart Contract deployed =', this.idopool.address);
    });

    describe('Time and Cap Constraints', function() {

        it('should be ended when cap is reached', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            let ended = await this.idopool.hasEnded();
            ended.should.equal(false);
            await this.idopool.contribute(this.investor.address, {
                value: this.weiMaxCont,
                from: this.investor.address
            });
            await this.idopool.contribute(this.investor.address, {
                value: this.weiMaxCont,
                from: this.investor.address
            });
            ended = await this.idopool.hasEnded();
            ended.should.equal(true);
        });

        it('should be ended after end time', async function() {
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
            await this.idopool.contribute(this.investor.address, {
                from: this.investor.address,
                value: this.contribution
            }).should.be.rejectedWith('revert');
        });

        it('should accept valid contributions after start', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.send(this.contribution).should.be.fulfilled;
            await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
                from: this.investor.address
            }).should.be.fulfilled;
        });

        it('should reject contributions after end time', async function() {
            await increaseTimeTo(this.afterEndTime, latestTime.timestamp);
            await this.idopool.send(this.contribution).should.be.rejectedWith('revert');
            await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
                from: this.investor.address
            }).should.be.rejectedWith('revert');
        });
    });

    describe("Contribution Process", function () {

        it('should reject contributions that are too small', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.send(this.smallerCont).should.be.rejectedWith("Invalid Purchase");
            await this.idopool.contribute(this.investor.address, {
                value: this.smallerCont,
                from: this.investor.address
            }).should.be.rejectedWith("Invalid Purchase");
        });

        it('should reject contributions that are too big', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            await this.idopool.send(this.largerCont).should.be.rejectedWith("Invalid Purchase");
            await this.idopool.contribute(this.investor.address, {
                value: this.largerCont,
                from: this.investor.address
            }).should.be.rejectedWith("Invalid Purchase");
        });

        it("should forward contribution to wallet", async function () {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const w_start = await web3.eth.getBalance(this.wallet);

            await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
                from: this.investor.address
            }).should.be.fulfilled;

            const w_end = await web3.eth.getBalance(this.wallet);
            const c_end = await web3.eth.getBalance(this.idopool.address);

            const wend = new ethers.BigNumber.from(w_end);
            const wstart = new ethers.BigNumber.from(w_start);

            // contribution went to wallet
            wend.sub(wstart).should.be.equal(this.contribution);
            // contribution not in smart contract address, which has nothing
            c_end.should.be.bignumber.equal(0);
        });

        it('should log contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const { logs } = await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
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

    describe("Contribution Costs", function () {
        it("should cost investor their contribution value + gas", async function () {

            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const p_start = await web3.eth.getBalance(this.investor.address);

            const logs = await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
                from: this.investor.address
            }).should.be.fulfilled;

            const p_end = await web3.eth.getBalance(this.investor.address);

            const gas_used = new ethers.BigNumber.from(logs.receipt.gasUsed);
            const gas_price = new ethers.BigNumber.from(logs.receipt.effectiveGasPrice);
            const pend = new ethers.BigNumber.from(p_end);
            const pstart = new ethers.BigNumber.from(p_start);

            // investor ending balance + (gas used * gas price) = investor starting balance - contribution
            pend.add(gas_used.mul(gas_price)).should.be.equal(pstart.sub(this.contribution));
        });

        it('should log contribution', async function() {
            await increaseTimeTo(this.startTime, latestTime.timestamp);
            const { logs } = await this.idopool.contribute(this.investor.address, {
                value: this.contribution,
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