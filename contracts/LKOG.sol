//SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/utils/Counters.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol';
import '@openzeppelin/contracts/interfaces/IERC721.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/interfaces/IERC165.sol';
import '@openzeppelin/contracts/interfaces/IERC2981.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

contract LKOG is  ERC721Enumerable, Ownable, Pausable, ReentrancyGuard, IERC2981 {
    using Strings for uint256;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    bool public transferActive = false;
    bool public mintActive = false;  

    uint8 private constant mintBatchLimit = 5; 

    uint16 internal royalty = 1000; // base 10000, 10%
    uint16 public constant SPLIT_BASE = 10000;
    uint16 public constant BASE = 10000;
    uint16 public constant MAX_TOKENS = 4500; // Max number of OG memberships to be minted
    string private baseURI;
    string private tokenSuffixURI;
    string private contractMetadata = 'contract.json';

    address[] private recipients;
    uint16[] private splits;

    mapping(bytes32 => bool) private usedTokens;

    mapping(address => bool) public collections;

    mapping(address => bool) public proxyRegistryAddress;

    event MembershipMinted(address indexed owner, uint256 _amount, address[] indexed contractsAddresses, uint256[] tokenIds);
    event ContractWithdraw(address indexed initiator, uint256 amount);
    event ContractWithdrawToken(address indexed initiator, address indexed token, uint256 amount);
    event WithdrawAddressChanged(address indexed previousAddress, address indexed newAddress);

    constructor(
        string memory name_, 
        string memory symbol_, 
        string memory uriPrefix_, 
        string memory uriSuffix_, 
        address[] memory _recipients,
        uint16[] memory _splits,
        address _proxyAddress
    ) ERC721(name_,symbol_) {
        baseURI = uriPrefix_;
        tokenSuffixURI = uriSuffix_;
        recipients = _recipients;
        splits = _splits;
        proxyRegistryAddress[_proxyAddress] = true;
    }

    function setCollections(address[] memory _addresses, bool status) external onlyOwner {
        for (uint8 i = 0; i < _addresses.length; i++) {
            collections[_addresses[i]] = status;
        }
    }

    /// @notice Mints OG cards based on user ownership of LK Art NFTs
    /// @param _addresses list of contract addresses 
    /// @param _tokens list of contract addresses
    /// Emits a {MembershipMinted} event.
    function redeemMembership(address[] memory _addresses, uint256[] memory _tokens) external {
        require(mintActive,'mint disabled');
        require(_addresses.length == _tokens.length && _tokens.length > 0,'Ids addresses donot match');
        require(uint256(MAX_TOKENS) >= super.totalSupply() + _tokens.length,'Exceeded max supply');
        emit MembershipMinted(msg.sender, _tokens.length, _addresses, _tokens);
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(collections[_addresses[i]], 'unsupported collection');
            IERC721 nftContract = IERC721(_addresses[i]);
            require(nftContract.ownerOf(_tokens[i]) == msg.sender,'unauthorized');
            bytes32 encodedToken = keccak256(abi.encode(_addresses[i],_tokens[i]));
            require(!usedTokens[encodedToken],'Token has been used');
            usedTokens[encodedToken] = true;
            _tokenIds.increment();
            _safeMint(msg.sender, _tokenIds.current());
        }
    }

    /// @notice Checks if a token has been used to mint OG card
    /// @param _contractAddress the NFT contract address
    /// @param _tokenId the token Id
    function isTokenUsed(address _contractAddress, uint256 _tokenId) public view returns (bool ) {
        return usedTokens[keccak256(abi.encode(_contractAddress,_tokenId))];
    }

    /// @notice Checks if minting is enabled
    function flipMintActive() external onlyOwner {
        mintActive = !mintActive;
    }

    /// @notice Checks if token transfer is enabled
    function flipTransferActive() external onlyOwner {
        transferActive = !transferActive;
    }

    function setBaseURI(string memory baseContractURI) external onlyOwner {
        baseURI = baseContractURI;
    }

    /**
    * @dev See {IERC721Metadata-tokenURI}.
    */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), 'ERC721Metadata: URI query for nonexistent token');

        string memory baseContractURI = _baseURI();
        return bytes(baseContractURI).length > 0 ? string(abi.encodePacked(baseContractURI, tokenId.toString(), tokenSuffixURI)) : '';
    }

    /**
    * @dev Base URI for computing {tokenURI}. If set, the resulting URI for each
    * token will be the concatenation of the `baseURI` and the `tokenId`. Empty
    * by default, can be overriden in child contracts.
    */
    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    /**
    * @dev returns the base contract metadata json object
    * this metadat file is used by OpenSea see {https://docs.opensea.io/docs/contract-level-metadata}
    *
    */
    function contractURI() external view returns (string memory) {
        string memory baseContractURI = _baseURI();
        return string(abi.encodePacked(baseContractURI, contractMetadata));
    }

    /**
    * @dev withdraws the contract balance and send it to the withdraw Addresses based on split ratio.
    *
    * Emits a {ContractWithdraw} event.
    */
    function withdraw() external nonReentrant onlyOwner {
        uint256 balance = address(this).balance;
        for (uint256 i = 0; i < recipients.length; i++) {
        (bool sent, ) = payable(recipients[i]).call{value: (balance * splits[i]) / SPLIT_BASE}('');
        require(sent, 'Withdraw Failed.');
        }
        emit ContractWithdraw(msg.sender, balance);
    }

    /// @dev withdraw ERC20 tokens divided by splits
    function withdrawTokens(address _tokenContract) external nonReentrant onlyOwner {
        IERC20 tokenContract = IERC20(_tokenContract);
        // transfer the token from address of Catbotica address
        uint256 balance = tokenContract.balanceOf(address(this));
        for (uint256 i = 0; i < recipients.length; i++) {
        tokenContract.transfer(recipients[i], (balance * splits[i]) / SPLIT_BASE);
        }
        emit ContractWithdrawToken(msg.sender, _tokenContract, balance);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Enumerable, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    function changeWithdrawAddress(address _recipient) external {
        require(_recipient != address(0), 'Cannot use zero address.');
        require(_recipient != address(this), 'Cannot use this contract address');
        require(!Address.isContract(_recipient), 'Cannot set recipient to a contract address');

        // loop over all the recipients and update the address
        bool _found = false;
        for (uint256 i = 0; i < recipients.length; i++) {
        // if the sender matches one of the recipients, update the address
        if (recipients[i] == msg.sender) {
            recipients[i] = _recipient;
            _found = true;
            break;
        }
        }
        require(_found, 'The sender is not a recipient.');
        emit WithdrawAddressChanged(msg.sender, _recipient);
    } 
   
    /// @notice Calculate the royalty payment
    /// @param _salePrice the sale price of the token
    function royaltyInfo(uint256, uint256 _salePrice)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        return (address(this), (_salePrice * royalty) / BASE);
    }

    /// @dev set the royalty
    /// @param _royalty the royalty in base 10000, 500 = 5%
    function setRoyalty(uint16 _royalty) external virtual onlyOwner {
        require(_royalty >= 0 && _royalty <= 1000, 'Royalty must be between 0% and 10%.');

        royalty = _royalty;
    }
 
    /**
     * Function to allow receiving ETH sent to contract
     *
     */
    receive() external payable {}

    /**
     * Override isApprovedForAll to whitelisted marketplaces to enable gas-free listings.
     *
     */
    function isApprovedForAll(address _owner, address _operator) public view override(ERC721, IERC721) returns (bool isOperator) {
        // check if this is an approved marketplace
        if (proxyRegistryAddress[_operator]) {
            return true;
        }
        // otherwise, use the default ERC721 isApprovedForAll()
        return super.isApprovedForAll(_owner, _operator);
    }

    /**
     * Function to set status of proxy contracts addresses
     *
     */
    function setProxy(address _proxyAddress, bool _value) external onlyOwner {
        proxyRegistryAddress[_proxyAddress] = _value;
    }

    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");
        _burn(tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId);

        require(!paused(),'ERC721Pausable: token transfer while paused');
        require(transferActive || from == address(0),'ERC721Pausable: token transfer while paused');
    }
}