// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./openzeppelin/Pausable.sol";
import "./openzeppelin/SafeMath.sol";
import "./openzeppelin/IERC20.sol";
import "./openzeppelin/SafeERC20.sol";
import "./openzeppelin/Context.sol";
import "./univ2/UniswapV2Pair.sol";

contract Staking is Context, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // amount of LP token staking
        uint256 amountCe; // amount of CE share corresponding to deposited LP amount at the time of deposit(s), this is fixed value set only on deposit, should not be impacted by LP supply/reserve fluctuations
        uint256 depositTime; // latest deposit time from a user
        uint256 withdrawRequest; // withdrawal request time
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract
        uint256 allocPoint; // How many allocation points assigned to this pool (currently unused after initiation)
        uint256 lastRewardTime; // Last second that reward distribution occurs (currently unused after initiation)
        uint256 accRewardPerShare; // Accumulated rewards per share (currently unused after initiation)
        IERC20 pegToken; // Address of the peg token contract that will be transfered to/from users to represent the amountCe from UserInfo
    }

    // Token for rewards
    IERC20 public CeToken;
    // The total amount of rewards paid out
    uint256 public paidOut = 0;
    // The block timestamp when reward mining starts
    uint256 public startTime;
    // The block timestamp when reward mining ends
    uint256 public endTime;
    // Info of each pool
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points assigned to pools
    uint256 public totalAllocPoint = 0;
    // Time lock for each LP pool
    mapping(address => uint256) public lockTime;

    /**
     * event for deposit logging
     * @param user who deposited LP tokens
     * @param pid index of pool that was deposited to
     * @param amount amount of LP tokens
     */
    event Deposit (
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    /**
     * event for withdrawal logging
     * @param user who withdrew LP tokens
     * @param pid index of pool that was withdrawn from
     * @param amount amount of LP tokens
     */
    event Withdraw (
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    /**
     * constructor for Staking
     * require statements to revert contract initiation when conditions are not met
     * checks end time greater than start time
     * checks start time greater than or equal to current block timestamp
     * @param _ceToken erc20 ce token for rewards
     * @param _startTime start time of reward mining
     * @param _endTime end time of reward mining
     */
    constructor (
        IERC20 _ceToken,
        uint256 _startTime,
        uint256 _endTime
    ) public {
        require(_endTime > _startTime);
        require(_startTime >= block.timestamp);
        CeToken = _ceToken;
        startTime = _startTime;
        endTime = _endTime;
    }

    /**
     * @dev Time lock for adding lp pool. Can only be called by the owner.
     * This will set the locktime for an lp pool to 48 hours after current block timestamp
     * @param _lpToken the lp token for the pool
     */
    function addTimeLock(IERC20 _lpToken) public onlyOwner {
        lockTime[address(_lpToken)] = block.timestamp + 172800;
    }

    /**
     * @dev Add a new lp to the pool, reset the locktime for that pool. Can only be called by the owner.
     * XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
     * require statements to revert state when conditions are not met
     * checks whether CeToken is in the _lpToken pair before being added as a pool
     * checks whether locktime was initiated for the lp pool
     * checks whether current block timestamp is greater than locktime for the lp pool
     * @param _allocPoint pool allocation points (unused in other methods)
     * @param _lpToken the lp token for the pool
     * @param _pegToken the peg token for the pool
     */
    function add(uint256 _allocPoint, IERC20 _lpToken, IERC20 _pegToken) public onlyOwner {
        IUniswapV2Pair pair = IUniswapV2Pair(address(_lpToken));
        IERC20 token0 = IERC20(pair.token0());
        IERC20 token1 = IERC20(pair.token1());
        require(address(token0) == address(CeToken) || address(token1) == address(CeToken), "add: CeToken not found in pair");
        require(lockTime[address(_lpToken)] != 0, "add: timelock not initiated");
        require(block.timestamp > lockTime[address(_lpToken)], "add: timelock not complete");
        lockTime[address(_lpToken)] = 0;
        uint256 lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardTime: lastRewardTime,
            accRewardPerShare: 0,
            pegToken: _pegToken
        }));
    }


    /**
     * @dev Deposit LP tokens to staking contract for CE allocation and emits an event.
     * This will transfer any pending rewards to the user
     * This will transfer the LP token amount to the contract
     * This will transfer the peg token to the user based on CE share compute from LP token
     * This will also adjust user information to reflect latest deposit amounts, deposit time, and reset withdrawal request time
     * @param _pid the pool index
     * @param _amount the amount of LP tokens being deposited
     */
    function deposit(uint256 _pid, uint256 _amount) public validatePoolByPid(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        if (user.amountCe > 0 && user.amount > 0) {
            uint256 rewardAmount = computeReward(_pid, address(msg.sender));
            safeCeTransfer(msg.sender, rewardAmount);
        }
        uint256 _amountCe = computeCeShareFromLp(_pid, _amount);
        pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
        pool.pegToken.safeTransfer(address(msg.sender), _amountCe);
        user.amount = user.amount.add(_amount);
        user.amountCe = user.amountCe.add(_amountCe);
        user.depositTime = block.timestamp;
        user.withdrawRequest = 0;
        emit Deposit(msg.sender, _pid, _amount);
    }

    /**
     * @dev Withdraw cooldown period. Sets withdrawal request timestamp for msg sender.
     * require statements to revert state when conditions are not met
     * checks user LP amount deposited is greater than 0
     * checks user CE share equivalent to LP amount deposited is greater than 0
     * checks user withdrawal request time is currently 0 (no pending withdrawal requests)
     * checks current block timestamp is greater than user deposit time
     * @param _pid the pool index
     */
    function withdrawCooldown(uint256 _pid) public validatePoolByPid(_pid) {
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount > 0);
        require(user.amountCe > 0);
        require(user.withdrawRequest == 0);
        require(block.timestamp > user.depositTime);
        user.withdrawRequest = block.timestamp;
    }

    /**
     * @dev Withdraw LP tokens from staking contract and emits an event.
     * require statements to revert state when conditions are not met
     * checks whether user LP deposit is greater than or equal to withdrawal request amount
     * checks whether withdrawal cooldown was initiated
     * checks whether user withdrawal request occurs after deposit time
     * checks whether current block timestamp is greater than user withdrawal request timestamp plus 48h (enforcing the cooldown period)
     * This will transfer any pending rewards to the user
     * This will transfer the LP token amount to the user
     * This will transfer the peg token to the contract that is proportional to the LP token amount being withdrawn to the user
     * This will also adjust user information to reflect latest deposit amounts, and reset withdrawal request time
     * @param _pid the pool index
     * @param _amount the amount of LP tokens being withdrawn
     */
    function withdraw(uint256 _pid, uint256 _amount) public validatePoolByPid(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: can't withdraw more than deposit");
        require(user.withdrawRequest != 0 && user.depositTime != 0, "withdraw: cooldown not initiated");
        require(user.withdrawRequest > user.depositTime, "withdraw: request before deposit");
        require(block.timestamp > (user.withdrawRequest + 172800), "withdraw: cooldown not complete");
        uint256 _amountCe = propCeShare(_pid, address(msg.sender), _amount);
        require(user.amountCe >= _amountCe, "withdraw: peg token exceeds deposit");
        uint256 rewardAmount = computeReward(_pid, address(msg.sender));
        safeCeTransfer(msg.sender, rewardAmount);
        user.amount = user.amount.sub(_amount);
        user.amountCe = user.amountCe.sub(_amountCe);
        user.withdrawRequest = 0;
        pool.pegToken.safeTransferFrom(address(msg.sender), address(this), _amountCe);
        pool.lpToken.safeTransfer(address(msg.sender), _amount);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /**
     * @dev Safe internal transfer function, just in case if rounding error causes pool to not have enough rewards.
     * @param _to the recipient address
     * @param _amount the amount of rewards
     */
    function safeCeTransfer(address _to, uint256 _amount) internal {
        uint256 ifBal = CeToken.balanceOf(address(this));
        if (_amount > ifBal) {
            CeToken.transfer(_to, ifBal);
            paidOut += ifBal;
        } else {
            CeToken.transfer(_to, _amount);
            paidOut += _amount;
        }
    }

    /**
     * @dev Public View function to get pending Rewards for a user.
     * require statements to revert state when conditions are not met
     * checks current block timestamp is greater than user deposit timestamp
     * This will backwards compute the pending CE rewards for a given user based on their deposit time and a preset apy scheme
     * The time since user deposit is separated into days, hours, and minutes for faster computes
     * apy is increased by 7% on a monthly basis, until 12 months at which point the apy is capped
     * @param _pid the pool index
     * @param _user the address of user
     * @return amount of ce rewards
     */
    function computeReward(uint256 _pid, address _user) public view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        require(block.timestamp >= user.depositTime);

        // solidity likes whole numbers, we cant divide or use fractions in operations
        // we also have to be careful of overflow when using power operator
        uint256 lastTime = block.timestamp < endTime ? block.timestamp : endTime;
        uint256 secSinceDeposit = lastTime.sub(user.depositTime); // time between current block and user deposit to staking

        uint256 rewards = 0;
        uint256 total = user.amountCe;

        // X time since user deposit, rounded down automatically
        uint256 daySinceDeposit = secSinceDeposit / 86400;
        uint256 hoursSinceDeposit = secSinceDeposit / 3600;
        uint256 baseApy = 4996358; // = (1.2^(1/365)-1) * 1e10
        uint256 baseApyHr = 208131; // = (1.2^(1/8760)-1) * 1e10, SED-04
        uint256 baseApySec = 51873; // = (1.2^(1/31536000)-1) * 1e13, SED-04

        if (daySinceDeposit >= 1) {
            for (uint t = 1; t <= daySinceDeposit; t++) {
                if (t % 30 == 0 && t < 365) {
                    baseApy = baseApy.mul(107).div(100);
                    baseApySec = baseApySec.mul(107).div(100);
                    baseApyHr = baseApyHr.mul(107).div(100);
                }
                rewards = rewards + total.mul(baseApy).div(1e10);
                total = total + total.mul(baseApy).div(1e10);
            }
            secSinceDeposit = secSinceDeposit.sub(daySinceDeposit.mul(86400));
            hoursSinceDeposit = secSinceDeposit / 3600;
        }
        if (hoursSinceDeposit >= 1) {
            for (uint t = 1; t <= hoursSinceDeposit; t++) {
                rewards = rewards + total.mul(baseApyHr).div(1e10);
                total = total + total.mul(baseApyHr).div(1e10);
            }
            secSinceDeposit = secSinceDeposit.sub(hoursSinceDeposit.mul(3600));
        }
        if (secSinceDeposit >= 1) {
            for (uint t = 1; t <= secSinceDeposit; t++) {
                rewards = rewards + total.mul(baseApySec).div(1e13);
                total = total + total.mul(baseApySec).div(1e13);
            }
        }
        return rewards;
    }

    /**
     * @dev Public View function to get ce share of LP deposit for a user.
     * This intializes a UniswapV2Pair on the LP token address (which will be on univ2)
     * It computes the CE share for an LP amount using the total supply of the LP token and then Reserve amounts for both tokens in the pair
     * It ensures an accurate compute by checking reserve token addresses in the pair
     * @param _pid the pool index
     * @param _amount the amount of LP token being deposited
     * @return amount of ce that corresponds to the lp deposit amount
     */
    function computeCeShareFromLp(uint256 _pid, uint256 _amount) public view validatePoolByPid(_pid) returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        uint256 totalLpSupply = pool.lpToken.totalSupply();
        IUniswapV2Pair pair = IUniswapV2Pair(address(pool.lpToken));
        (uint112 res0, uint112 res1, ) = pair.getReserves();
        IERC20 token0 = IERC20(pair.token0());
        IERC20 token1 = IERC20(pair.token1());
        uint256 ceShare;
        if (address(token0) == address(CeToken)) {
            ceShare = _amount.mul(res0).div(totalLpSupply);
        } else if (address(token1) == address(CeToken)) {
            ceShare = _amount.mul(res1).div(totalLpSupply);
        } else {
            ceShare = 0;
        }
        return ceShare;
    }

    /**
     * @dev View function to get ce share corresponding to lp amount for withdrawals.
     * @param _pid the pool index
     * @param _user the address of user
     * @param _amount the amount of LP token being withdrawn
     * @return amount of ce that corresponds to the lp withdrawal amount
     */
    function propCeShare(uint256 _pid, address _user, uint256 _amount) public view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        uint256 propCe = _amount.mul(user.amountCe).div(user.amount);
        return propCe;
    }

    /**
     * @dev View function to get pending Rewards for a user.
     * @param _pid the pool index
     * @param _user the address of user
     * @return the amount of pending ce rewards
     */
    function pendingRewards(uint256 _pid, address _user) external view validatePoolByPid(_pid) returns (uint256) {
        uint256 rewardAmount = computeReward(_pid, _user);
        return rewardAmount;
    }

    /**
     * @dev View function to get deposited LP for a user.
     * @param _pid the pool index
     * @param _user the address of user
     * @return the amount of LP tokens deposited
     */
    function deposited(uint256 _pid, address _user) external view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return user.amount;
    }

    /**
     * @dev View function to get the deposited CE share for a user.
     * @param _pid the pool index
     * @param _user the address of user
     * @return the amount of CE share corresponding to deposited LP amount at the time of deposit(s)
     */
    function depositedCe(uint256 _pid, address _user) external view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return user.amountCe;
    }

    /**
     * @dev View function to get latest user deposit time
     * @param _pid the pool index
     * @param _user the address of user
     * @return the most recent user deposit timestamp
     */
    function depositedTime(uint256 _pid, address _user) external view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return user.depositTime;
    }

    /**
     * @dev View function to get latest user withdrawal request time
     * @param _pid the pool index
     * @param _user the address of user
     * @return the latest user withdrawal request time, can be zero if it hasn't been requested
     */
    function depositWithdrawRequest(uint256 _pid, address _user) external view validatePoolByPid(_pid) returns (uint256) {
        UserInfo storage user = userInfo[_pid][_user];
        return user.withdrawRequest;
    }

    /**
     * @dev Modifier that requires a pool with _pid to exist.
     */
    modifier validatePoolByPid(uint256 _pid) {
        require (_pid < poolInfo.length , "Pool does not exist") ;
        _;
    }

}
