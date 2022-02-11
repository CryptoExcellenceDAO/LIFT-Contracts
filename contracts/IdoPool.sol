// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./openzeppelin/Pausable.sol";
import "./openzeppelin/SafeMath.sol";
import "./openzeppelin/ReentrancyGuard.sol";
import "./access/Roles.sol";
import "./openzeppelin/IERC20.sol";
import "./openzeppelin/SafeERC20.sol";
import "./openzeppelin/Context.sol";

contract IdoPool is Context, Pausable, ReentrancyGuard {
    using SafeMath for uint256;
    using Roles for Roles.Role;
    using SafeERC20 for IERC20;

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
    // min and max contribution allowed (both inclusive)
    uint256 public weiMaxCont;
    uint256 public weiMinCont;
    // address where funds are collected
    address payable private wallet;
    // amount of raised money
    uint256 private weiRaised;

    // usdt
    IERC20 public usdt;

    /**
     * event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value amount paid for purchase
     */
    event TokenContribution(
        address indexed purchaser,
        address indexed beneficiary,
        uint256 value
    );

    /**
     * event for added whitlist account logging
     * @param account who was added
     */
    event WhitelistedAdded(
        address indexed account
    );

    /**
     * event for removed whitlist account logging
     * @param account who was removed
     */
    event WhitelistedRemoved(
        address indexed account
    );

    /**
     * constructor for IdoPool
     * require statements to revert contract initiation when conditions are not met
     * checks start time greater than or equal to current timestamp
     * checks end time greater than or equal to start time
     * checks wallet is non zero address
     * checks admin is non zero address
     * checks erc20 (usdt) is non zero address
     * checks max individual contribution greater than or equal to min individual contribution
     * checks min individual contribution is non zero
     * checks pool cap is greater than zero
     * checks pool cap is greater than or equal to individual max contribution
     * @param _startTime pool start unix time
     * @param _endTime pool end unix time
     * @param _wallet fund collection wallet
     * @param _weiMaxCont max contribution
     * @param _weiMinCont min contribution
     * @param _cap pool cap
     * @param _adminAddr admin address for modifiers
     * @param _usdtAddr erc20 (usdt) address
     */
    constructor (
        uint256 _startTime,
        uint256 _endTime,
        address _wallet,
        uint256 _weiMaxCont,
        uint256 _weiMinCont,
        uint256 _cap,
        address _adminAddr,
        address _usdtAddr
    ) public {
        require(_startTime >= block.timestamp);
        require(_endTime >= _startTime);
        require(_wallet != address(0));
        require(_adminAddr != address(0));
        require(_usdtAddr != address(0));
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

        usdt = IERC20(_usdtAddr);
    }

    /**
     * @dev receive function revert
     */
    receive () external payable {
        // dont accept unsolicited ether
        revert("error");
    }

    /**
     * @dev low level token purchase function
     * function has non-reentrancy guard, so shouldn't be called by another nonReentrant function
     * @param beneficiary recipient of the token purchase
     * @param amount the contribution amount
     */
    function contribute(address beneficiary, uint256 amount) public nonReentrant {
        require(beneficiary != address(0));
        require(validPurchase(amount), "Invalid Purchase");
        // contribution event
        emit TokenContribution(_msgSender(), beneficiary, amount);
        // transfer funds
        forwardFunds(amount);
    }

    /**
     * @dev send erc20 (usdt) to the fund collection wallet
     * @param amount the contribution amount
     */
    function forwardFunds(uint256 amount) internal {
        usdt.safeTransferFrom(
            _msgSender(),
            wallet,
            amount
        );
        // log contribution
        if (contributions[_msgSender()] == 0) {
            totalContributors++;
        }
        contributions[_msgSender()] += amount;
        // update state
        weiRaised = weiRaised.add(amount);
    }

    /**
     * @dev validation of an incoming purchase
     * require statements to revert state when conditions are not met
     * checks amount wouldn't send total funds raised over the pool cap
     * checks contribution is within start/end timestamps
     * checks amount is non zero
     * checks amount is within individual min/max caps
     * checks amount wouldn't send total individual contribution above max cap
     * checks contribution sender is whitelisted
     * @param amount the contribution amount
     * @return true if the transaction is a valid contribution
     */
    function validPurchase(uint256 amount) internal view returns (bool) {
        bool withinCap = weiRaised.add(amount) <= cap;
        bool withinPeriod = block.timestamp >= startTime && block.timestamp <= endTime;
        bool nonZeroPurchase = amount != 0;
        bool withinContLimits = amount >= weiMinCont && amount <= weiMaxCont;
        bool withinMultiContLimits = (contributions[_msgSender()] + amount) <= weiMaxCont;
        bool withinWhiteList = isWhitelisted(_msgSender());
        return withinCap && withinPeriod && nonZeroPurchase && withinContLimits && withinMultiContLimits && withinWhiteList;
    }

    /**
     * @dev modifier that requires sender to be whitelist admin and calls isWhitelistAdmin
     */
    modifier onlyWhitelistAdmin() {
        require(isWhitelistAdmin(_msgSender()), "WhitelistAdminRole: caller does not have the WhitelistAdmin role");
        _;
    }

    /**
     * @param account the sender address
     * @return true if address is whitelist admin
     */
    function isWhitelistAdmin(address account) public view returns (bool) {
        return whitelistAdmin == account;
    }

    /**
     * @dev accepts an array of addresses and calls _addWhitelisted for each address.
     * @param accounts array of addresses
     */
    function addWhitelisted(address[] memory accounts) public onlyWhitelistAdmin {
        // use memory here instead of storage
        for (uint256 ind = 0; ind < accounts.length; ind++) {
            _addWhitelisted(accounts[ind]);
        }
    }

    /**
     * @dev accepts an array of addresses and calls _removeWhitelisted for each address.
     * @param accounts array of addresses
     */
    function removeWhitelisted(address[] memory accounts) public onlyWhitelistAdmin {
        // use memory here instead of storage
        for (uint256 ind = 0; ind < accounts.length; ind++) {
             _removeWhitelisted(accounts[ind]);
        }
    }

    /**
     * @dev adds address to whitelisted addresses and emits an event.
     * @param account the address to add to whitelist
     */
    function _addWhitelisted(address account) internal {
        whitelisteds.add(account);
        emit WhitelistedAdded(account);
    }

     /**
     * @dev removes address from whitelisted addresses and emits an event.
     * @param account the address to remove from whitelist
     */
    function _removeWhitelisted(address account) internal {
        whitelisteds.remove(account);
        emit WhitelistedRemoved(account);
    }

    /**
     * @param account an address
     * @return true if address is whitelisted
     */
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

    /**
     * @param account an address
     * @return the total contribution for an address.
     */
    function getAddrContribution(address account) public view returns (uint256) {
        return contributions[account];
    }

}