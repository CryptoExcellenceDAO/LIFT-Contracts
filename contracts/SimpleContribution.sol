pragma solidity ^0.8.0;


import "./openzeppelin/Pausable.sol";
import "./openzeppelin/SafeMath.sol";
//import "./openzeppelin/IERC20.sol";
import "./openzeppelin/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address _to, uint256 _value) external returns (bool);
    // don't need to define other functions, only using `transfer()` in this case
}

contract SimpleContribution is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    // start and end timestamps where investments are allowed (both inclusive)
    uint256 public startTime;
    uint256 public endTime;
    // address where funds are collected
    address payable public wallet;
    // pool max cap
    uint256 public cap;
    // min and max contribution allowed in wei (both inclusive)
    uint256 public weiMaxCont;
    uint256 public weiMinCont;
    // amount of raised money in wei
    uint256 public weiRaised;
    // ierc20 token
    IERC20 public token;

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

    constructor (
        uint256 _startTime,
        uint256 _endTime,
        address _wallet,
        uint256 _weiMaxCont,
        uint256 _weiMinCont,
        uint256 _cap
    ) public {
        require(_startTime >= block.timestamp);
        require(_endTime >= _startTime);
        require(_wallet != address(0));
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
    }

    // fallback function can be used to buy tokens
    fallback() external payable {
        contribute(msg.sender);
    }

    // low level token purchase function
    function contribute(address beneficiary) public payable nonReentrant {
        require(beneficiary != address(0));
        require(validPurchase(), "Invalid Purchase");

        // contribution amount
        uint256 weiAmount = msg.value;
        // update state
        weiRaised = weiRaised.add(weiAmount);
        // contribution event
        emit TokenContribution(msg.sender, beneficiary, weiAmount);
        // transfer funds
        forwardFunds();
    }

    // send ether to the fund collection wallet
    function forwardFunds() internal {
        wallet.transfer(msg.value);
    }

    // @return true if the transaction can buy tokens
    function validPurchase() internal view returns (bool) {
        bool withinCap = weiRaised.add(msg.value) <= cap;
        bool withinPeriod = block.timestamp >= startTime && block.timestamp <= endTime;
        bool nonZeroPurchase = msg.value != 0;
        bool withinContLimits = msg.value >= weiMinCont && msg.value <= weiMaxCont;
        return withinCap && withinPeriod && nonZeroPurchase && withinContLimits;
    }

    // @return true if crowdsale event has ended
    function hasEnded() public view returns (bool) {
        bool capReached = weiRaised >= cap;
        bool timeReached = block.timestamp > endTime;
        return capReached || timeReached;
    }

    function getRaised() public view returns (uint256) {
        return weiRaised;
    }

}