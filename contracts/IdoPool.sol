pragma solidity ^0.8.0;


import "./openzeppelin/Pausable.sol";
import "./openzeppelin/SafeMath.sol";
import "./openzeppelin/ReentrancyGuard.sol";
import "./access/Roles.sol";
//import "./openzeppelin/IERC20.sol";
//import "./GSN/Context.sol";

/*
interface IERC20 {
    function transfer(address _to, uint256 _value) external returns (bool);
    // don't need to define other functions, only using `transfer()` in this case
}
*/

contract IdoPool is Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using Roles for Roles.Role;

    // keeping track of contributors
    mapping(address => uint256) public contributions;
    // whitelisted addresses
    Roles.Role private whitelisteds;
    // admin role
    address private whitelistAdmin;
    // total number of contributors
    uint256 public totalContributors;
    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    uint256 public endTime;
     // pool max cap
    uint256 public cap;
    // min and max contribution allowed in wei (both inclusive)
    uint256 public weiMaxCont;
    uint256 public weiMinCont;
    // address where funds are collected
    address payable private wallet;
    // amount of raised money in wei
    uint256 private weiRaised;

    /**
     * event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     */
    event TokenContribution(
        address indexed purchaser,
        address indexed beneficiary,
        uint256 value
    );

    event WhitelistedAdded(
        address indexed account
    );

    /**
     * constructor for IdoPool
     * @param _startTime pool start time
     * @param _endTime pool end time
     * @param _wallet fund collection wallet
     * @param _weiMaxCont max contribution in wei
     * @param _weiMinCont min contribution in wei
     * @param _cap pool cap
     */
    constructor (
        uint256 _startTime,
        uint256 _endTime,
        address _wallet,
        uint256 _weiMaxCont,
        uint256 _weiMinCont,
        uint256 _cap,
        address _adminAddr
    ) public {
        require(_startTime >= block.timestamp);
        require(_endTime >= _startTime);
        require(_wallet != address(0));
        require(_adminAddr != address(0));
        require(_weiMaxCont >= _weiMinCont);
        require(_weiMinCont != 0);
        require(_cap > 0);
        require(_cap >= _weiMaxCont);

        startTime = _startTime;
        endTime = _endTime;
        wallet = payable(_wallet);
        weiMaxCont = _weiMaxCont;
        weiMinCont = _weiMinCont;
        cap = _cap;
        whitelistAdmin = _adminAddr;

        weiRaised = 0;
        totalContributors = 0;
    }

    /**
     * @dev fallback function can be used to buy tokens
     */
    receive () external payable {
        contribute(msg.sender);
    }

    /**
     * @dev low level token purchase function
     * function has non-reentrancy guard, so shouldn't be called by another nonReentrant function
     * @param beneficiary Recipient of the token purchase
     */
    function contribute(address beneficiary) public payable nonReentrant {
        require(beneficiary != address(0));
        require(validPurchase(), "Invalid Purchase");

        // contribution amount
        uint256 weiAmount = msg.value;
        // update state
        //weiRaised = weiRaised.add(weiAmount);
        // contribution event
        emit TokenContribution(msg.sender, beneficiary, weiAmount);
        // transfer funds
        forwardFunds();
    }

    /**
     * @dev send ether to the fund collection wallet
     */
    function forwardFunds() internal {
        // This forwards all available gas. Be sure to check the return value!
        (bool success, ) = wallet.call{value: msg.value}("");
        // This forwards X gas, which may not be enough if the recipient is a contract and gas costs change.
        //wallet.transfer(msg.value);
        if ( success ) {
            // log contribution
            if (contributions[msg.sender] == 0) {
                totalContributors++;
            }
            contributions[msg.sender] += msg.value;
            // update state
            weiRaised = weiRaised.add(msg.value);
        }
    }

    /**
     * @dev validation of an incoming purchase
     * require statements to revert state when conditions are not met
     * @return true if the transaction is a valid contribution
     */
    function validPurchase() internal view returns (bool) {
        bool withinCap = weiRaised.add(msg.value) <= cap;
        bool withinPeriod = block.timestamp >= startTime && block.timestamp <= endTime;
        bool nonZeroPurchase = msg.value != 0;
        bool withinContLimits = msg.value >= weiMinCont && msg.value <= weiMaxCont;
        bool withinMultiContLimits = (contributions[msg.sender] + msg.value) <= weiMaxCont;
        bool withinWhiteList = isWhitelisted(msg.sender);
        return withinCap && withinPeriod && nonZeroPurchase && withinContLimits && withinMultiContLimits && withinWhiteList;
    }

    modifier onlyWhitelistAdmin() {
        require(isWhitelistAdmin(msg.sender), "WhitelistAdminRole: caller does not have the WhitelistAdmin role");
        _;
    }

    function isWhitelistAdmin(address account) public view returns (bool) {
        return whitelistAdmin == account;
    }

    function addWhitelisted(address account) public onlyWhitelistAdmin {
        _addWhitelisted(account);
    }

    function _addWhitelisted(address account) internal {
        whitelisteds.add(account);
        emit WhitelistedAdded(account);
    }

    function isWhitelisted(address account) public view returns (bool) {
        return whitelisteds.has(account);
    }

    /**
     * @return true if ido pool has ended
     */
    function hasEnded() public view returns (bool) {
        bool capReached = weiRaised >= cap;
        bool timeReached = block.timestamp > endTime;
        return capReached || timeReached;
    }

    /**
     * @return the address where funds are collected.
     */
    function getWallet() public view returns (address payable) {
        return wallet;
    }

    /**
     * @return the amount of wei raised.
     */
    function getWeiRaised() public view returns (uint256) {
        return weiRaised;
    }

    /**
     * @return the total number of contributors.
     */
    function getTotalContributors() public view returns (uint256) {
        return totalContributors;
    }

    function getAddrContribution(address account) public view returns (uint256) {
        return contributions[account];
    }

}