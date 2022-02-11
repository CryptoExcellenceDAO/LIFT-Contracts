// This won't work with latest contracts at the moment since the needed UniswapV2Pair integration isn't supported here

const { artifacts } = require("hardhat");

const BigNumber = web3.BigNumber;
const should = require("chai")
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

const Staking = artifacts.require("Staking");
const TokTest = artifacts.require("TokTest");
const XCe = artifacts.require("XCe.sol")

describe("Staking", function () {

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

    async function outputBalances(lptoken, xcetoken, cetoken, staking_address, staker_address) {
        let staking_lp_bal = await lptoken.balanceOf(staking_address);
        let staking_xce_bal = await xcetoken.balanceOf(staking_address);
        let staking_ce_bal = await cetoken.balanceOf(staking_address);

        let user_lp_bal = await lptoken.balanceOf(staker_address);
        let user_xce_bal = await xcetoken.balanceOf(staker_address);
        let user_ce_bal = await cetoken.balanceOf(staker_address);

        console.log("\n===========================================");
        console.log("staking lp balance =", web3.utils.fromWei(staking_lp_bal.toString()).toString());
        console.log("staking xCE balance =", web3.utils.fromWei(staking_xce_bal.toString()).toString());
        console.log("staking CE balance =", web3.utils.fromWei(staking_ce_bal.toString()).toString());
        console.log("-------------------------------------------");
        console.log("user lp balance =", web3.utils.fromWei(user_lp_bal.toString()).toString());
        console.log("user xCE balance =", web3.utils.fromWei(user_xce_bal.toString()).toString());
        console.log("user CE balance =", web3.utils.fromWei(user_ce_bal.toString()).toString());
        console.log("===========================================\n");
    }

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

        const [owner, addr1] = await ethers.getSigners();

        this.staker1 = owner;
        this.staker2 = addr1;

        let tokName = "Uniswap V2";
        let tokSym = "UNI-V2";
        //100000 of these
        this.lptoken = await TokTest.new(
            tokName,
            tokSym
        );

        tokName = "Crypto Excellence";
        tokSym = "CE";
        //100000 of these
        this.cetoken = await TokTest.new(
            tokName,
            tokSym
        );

        this.ceTokenAddr = this.cetoken.address;
        this.rewardsPerSecond = web3.utils.toBN(web3.utils.toWei('0.000000001'));
        this.startTime = latestTime.timestamp;
        this.endTime = this.startTime + duration.days(1000);
        this.staking = await Staking.new(
            this.ceTokenAddr,
            this.rewardsPerSecond,
            this.startTime,
            this.endTime
        );
        console.log("LP Token address:", this.lptoken.address);
        console.log("Staking address:", this.staking.address);
        //100000 of these
        tokName = "XCrypto Excellence";
        tokSym = "xCE";

        this.xcetoken = await XCe.new(
            tokName,
            tokSym,
            this.staking.address
        )

        this.allocPoint = 1;

        await this.staking.add(
            this.allocPoint,
            this.lptoken.address,
            this.xcetoken.address
        )

        this.lpCont = web3.utils.toBN(web3.utils.toWei('100'));
        this.lpCeCont = web3.utils.toBN(web3.utils.toWei('100'));

        await this.cetoken.transfer(this.staking.address, web3.utils.toBN(web3.utils.toWei('10')));

        this.lptoken.approve(this.staking.address, this.lpCont);

        //console.log(this.staking.methods);

    });

    describe('Rewards Simulation', function() {

        it('Sim1', async function() {

            console.log("Staking start time =", this.startTime);
            console.log("Staking end time =",this.endTime);
            console.log("CE rewards per second =", web3.utils.fromWei(this.rewardsPerSecond.toString()));

            await this.staking.deposit(0, this.lpCont, this.lpCeCont, {
                from: this.staker1.address
            });

            //let computedCeShare = await this.staking.computeCeShareFromLp(0, this.lpCont);
            //console.log(computedCeShare);

            let deposit = await this.staking.deposited(0, this.staker1.address);
            let depositCe = await this.staking.depositedCe(0, this.staker1.address);
            let rewards = await this.staking.pendingRewards(0, this.staker1.address);

            console.log("user deposit =",web3.utils.fromWei(deposit.toString()).toString());
            console.log("user deposit (ce share of lp) =",web3.utils.fromWei(depositCe.toString()).toString());
            console.log("user rewards =",web3.utils.fromWei(rewards.toString()).toString());

            await outputBalances(this.lptoken, this.xcetoken, this.cetoken, this.staking.address, this.staker1.address);

            let rewardsArr = new Array(1);
            let unixArr = new Array(rewardsArr.length);
            let t_inc;
            let t_start = this.startTime;

            for (let i = 0; i < rewardsArr.length; i++) {

                //t_inc = t_start + duration.weeks(1);
                t_inc = t_start + duration.days(1);
                //t_inc = t_start + duration.seconds(1);
                await increaseTimeTo(t_inc, t_start);
                t_start = t_inc;

                //let curtime = await web3.eth.getBlock('latest');
                //console.log("current time =", curtime.timestamp.toString());

                rewards = await this.staking.pendingRewards(0, this.staker1.address);

                rewardsArr[i] = web3.utils.fromWei(rewards.toString()).toString();
                unixArr[i] = t_inc;
            }

            console.dir(rewardsArr, {'maxArrayLength': null});
            console.dir(unixArr, {'maxArrayLength': null});

            await this.staking.withdrawCooldown(0, {
                from: this.staker1.address
            });
            t_inc = t_start + duration.seconds(60);
            await increaseTimeTo(t_inc, t_start);
            await this.xcetoken.approve(this.staking.address, this.staker1.address);
            rewards = await this.staking.pendingRewards(0, this.staker1.address);
            console.log("user rewards =",web3.utils.fromWei(rewards.toString()).toString());
            await this.staking.withdraw(0, this.lpCont, this.lpCeCont, {
                from: this.staker1.address
            });

            await outputBalances(this.lptoken, this.xcetoken, this.cetoken, this.staking.address, this.staker1.address);

        });
    });
});