// SPDX-License-Identifier: MIT
// LastKnown Trio Staking Engine
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/security/Pausable.sol';

contract LKStaking is Ownable, Pausable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  // Interfaces for ERC20 and ERC721 contracts
  // ERC20 is for KNONW token used for rewards
  // ERC721 will be used for the membership cards and LK NFT collections
  IERC20 public immutable rewardsToken;

  bool public stakingActive;

  mapping(address => IERC721) public collections;
  mapping(address => IERC721) public memberships;

  // Staking account info
  struct Staker {
    // Id of membership card staked
    uint256 membershipId;
    // hashed encoded Ids and contracts addresses of ERC721 Tokens staked
    mapping(bytes32 => bool) tokens;
    // Number of ERC721 Tokens staked
    uint256 amountStaked;
    // Last time of details updated for this staking account
    uint256 lastUpdated;
    // Calculated, but unclaimed rewards for the User. The rewards are
    // calculated each time the user writes to the Smart Contract
    uint256 unclaimedRewards;
    // Overall accumalted rewards alreadt calimed by the user
    uint256 claimedRewards;
  }

  // Rewards amount per minute in KNOWN token in wei.
  uint256 private rewardsPerMinute = 100000;

  // Mapping of Wallet Address to Staker account info struct
  mapping(address => Staker) public stakers;

  // Mapping of Contract Address & Token Id to staker wallet address.
  // Easy query if a token in a contract is staked or not and the staker wallet address.
  mapping(address => mapping(uint256 => address)) public stakedAssets;

  /// @notice event emitted when a user has staked a membership card and/or LK NFTs
  event Staked(
    address indexed owner,
    address indexed membershipContract,
    uint256 indexed membershipId,
    address[] tokensContracts,
    uint256[] tokenIds
  );

  /// @notice event emitted when a user has unstaked a membership card and/or LK NFTs
  event Unstaked(
    address indexed owner,
    address indexed membershipContract,
    uint256 indexed membershipId,
    address[] tokensContracts,
    uint256[] tokenIds
  );

  /// @notice event emitted when a user claims KNOWN token rewards
  event RewardClaimed(address indexed user, uint256 reward);

  // Constructor function
  constructor(address _rewardsToken) {
    // initialize the ERC20 KNOWN token contract
    rewardsToken = IERC20(_rewardsToken);
    stakingActive = true;
  }

  function flipStakingActive() public onlyOwner {
    // activate and deactivate staking functionality
    stakingActive = !stakingActive;
  }

  // Require mebership Id and contract address and list of NFTs IDs and contracts addresses
  // If membership is already staked and there is at least one NFT staked recalculate the rewards.
  // the amountStaked gets incremented and stakedAssets gets updated
  function stake(
    uint256 _membershipId,
    address _membershipAddress,
    uint256[] calldata _tokenIds,
    address[] calldata _contractsAddresses
  ) external whenNotPaused nonReentrant {
    require(stakingActive, 'staking inactive');
    require(_tokenIds.length == _contractsAddresses.length, 'Ids and Addresses list not match');
    require(_tokenIds.length > 0, 'Need one or more NFT');
    require(memberships[_membershipAddress].ownerOf(_membershipId) == msg.sender, "Can't stake memberships cards you don't own!");
    require(stakers[msg.sender].membershipId == 0 || stakers[msg.sender].membershipId == _membershipId, 'Already have staked membership');

    if (stakers[msg.sender].membershipId > 0 && stakers[msg.sender].amountStaked > 0) {
      uint256 rewards = calculateRewards(msg.sender);
      stakers[msg.sender].unclaimedRewards += rewards;
    } else {
      stakers[msg.sender].membershipId = _membershipId;
    }

    emit Staked(msg.sender, _membershipAddress, _membershipId, _contractsAddresses, _tokenIds);

    uint256 numTokens = _tokenIds.length;
    for (uint256 i = 0; i < numTokens; i++) {
      require(collections[_contractsAddresses[i]].ownerOf(_tokenIds[i]) == msg.sender, "Can't stake tokens you don't own!");
      stakedAssets[_contractsAddresses[i]][_tokenIds[i]] = msg.sender;
      bytes32 encodedToken = keccak256(abi.encode(_contractsAddresses[i], _tokenIds[i]));
      require(!stakers[msg.sender].tokens[encodedToken], 'Already staked');
      stakers[msg.sender].tokens[encodedToken] = true;
    }

    //// commenting it out until adding function in membership contracts
    // memberships[_membershipAddress].markStaked(_membershipId);
    stakers[msg.sender].lastUpdated = block.timestamp;
    stakers[msg.sender].amountStaked += numTokens;
  }

  // Check if user has already a membership staked,
  // recalculate the unclaimed rewards
  // check if msg.sender is the original owner of membership card
  // if unstakeAll is true then withdraw the membership card, unstake NFTs and send the reward
  function unstake(
    uint256 _membershipId,
    address _membershipAddress,
    uint256[] calldata _tokenIds,
    address[] calldata _contractsAddresses,
    bool unstakeAll
  ) external whenNotPaused nonReentrant {
    require(_tokenIds.length == _contractsAddresses.length, 'Ids and Addresses list not match');
    require(_tokenIds.length > 0 || unstakeAll, 'Need one or more NFT');
    require(stakers[msg.sender].membershipId > 0 && stakers[msg.sender].membershipId == _membershipId, 'You have no tokens staked');
    emit Unstaked(msg.sender, _membershipAddress, stakers[msg.sender].membershipId, _contractsAddresses, _tokenIds);
    uint256 rewards = calculateRewards(msg.sender);
    stakers[msg.sender].unclaimedRewards += rewards;
    if (unstakeAll) {
      rewardsToken.safeTransfer(msg.sender, rewards);
      emit RewardClaimed(msg.sender, rewards);
      delete stakers[msg.sender];
    } else {
      uint256 numTokens = _tokenIds.length;
      for (uint256 i = 0; i < numTokens; i++) {
        require(collections[_contractsAddresses[i]].ownerOf(_tokenIds[i]) == msg.sender, "Can't unstake tokens you don't own!");
        bytes32 encodedToken = keccak256(abi.encode(_contractsAddresses[i], _tokenIds[i]));
        delete stakers[msg.sender].tokens[encodedToken];
        delete stakedAssets[_contractsAddresses[i]][_tokenIds[i]];
      }
      stakers[msg.sender].lastUpdated = block.timestamp;
    }
  }

  function setCollections(address[] memory _addresses) external onlyOwner {
    for (uint8 i = 0; i < _addresses.length; i++) {
      collections[_addresses[i]] = IERC721(_addresses[i]);
    }
  }

  function setMemberships(address[] memory _addresses) external onlyOwner {
    for (uint8 i = 0; i < _addresses.length; i++) {
      memberships[_addresses[i]] = IERC721(_addresses[i]);
    }
  }

  // Calculate rewards for the msg.sender, set unclaimedRewards to 0
  // set accumlative claimed amount and transfer the KOOWN toke Reward to the sender.
  function claimRewards() external whenNotPaused nonReentrant {
    uint256 rewards = calculateRewards(msg.sender) + stakers[msg.sender].unclaimedRewards;
    require(rewards > 0, 'Zero reward balance');
    rewardsToken.safeTransfer(msg.sender, rewards);
    emit RewardClaimed(msg.sender, rewards);
    stakers[msg.sender].lastUpdated = block.timestamp;
    stakers[msg.sender].unclaimedRewards = 0;
    stakers[msg.sender].claimedRewards += rewards;
  }

  // Set the rewardsPerMinute variable
  // Need consideration on how to recalculate unclaimed amounts
  function setRewardsPerMinute(uint256 _newValue) public onlyOwner {
    rewardsPerMinute = _newValue;
  }

  // Used so that we can query the available uncliamed rewards amount for any wallet
  function availableRewards(address _user) public view returns (uint256) {
    return stakers[_user].unclaimedRewards + calculateRewards(_user);
  }

  /////////////
  // Internal//
  /////////////

  // Calculate rewards for param staker address by calculating the time passed
  // since last update in hours and mulitplying by how many NFT Tokens Staked
  function calculateRewards(address _staker) internal view returns (uint256 _rewards) {
    if (stakers[_staker].amountStaked == 0) {
      return 0;
    }
    // time difference in munutes * number of NFTs staked * rewards per minute
    return (((((block.timestamp - stakers[_staker].lastUpdated) * stakers[_staker].amountStaked)) * rewardsPerMinute) / 60);
  }
}
