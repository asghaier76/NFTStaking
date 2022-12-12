// unit test file for NFT Sale contract
import { ethers } from 'hardhat'; // Import the Ethers library
import * as chai from 'chai';
// import * as mocha from "mocha"
import { expect } from 'chai'; // Import the "expect" function from the Chai assertion library
import '@nomiclabs/hardhat-ethers';
import { Contract, BigNumber, providers } from 'ethers';
import { beforeEach } from 'mocha';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { solidity } from 'ethereum-waffle';
import { sign } from 'crypto';
import { MerkleTree } from 'merkletreejs';
import keccak256 = require('keccak256');
chai.use(solidity);

// "describe" is used to group tests & enhance readability
describe('Mutant BioMorphans Drop', async () => {
  let contract: Contract;
  let erc20contract: Contract;
  let artist: SignerWithAddress;
  let bcf: SignerWithAddress;
  let members: SignerWithAddress[];
  let nonmembers: SignerWithAddress[];
  let recipient: SignerWithAddress;
  let signers: SignerWithAddress[];
  const provenanceHash: string = '8b941d8e038d49895ad2635b2ad1ebf4776793490cfde977f17c8c57d4d665ff';

  const _proxyAddress = '0xa5409ec958C83C3f309868babACA7c86DCB077c1';

  let redeemRootHash: Buffer;
  let presaleRootHash: Buffer;
  const baseContractURI = 'https://billionbuns.com/beforeReveal/';
  const postRevealBaseContractURI = 'https://billionbuns.com/postReveal/';
  const tokenSuffixURI = '.json';
  let membersList: string[];
  let whitelist: any = {};

  let balances = [5, 5, 5, 5, 5, 5, 5, 5];
  let redeemMerkleTree: MerkleTree;
  let presaleMerkleTree: MerkleTree;

  // Tracking number of tokens minted in presale and public sale excluding the giveaways tokens
  let numTokensMinted = 0;
  const maxToken = 1190;
  const giveawayLimit = 10;
  // one day in seconds
  const halfDay = 43200;
  const oneDay = 86400;
  const oneHour = 3600;
  const oneMinute = 60;

  const hashEntry = (address: string, amount: any) => {
    // return Buffer.from(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount])).slice(2), 'hex')
    return Buffer.from(ethers.utils.solidityKeccak256(['address', 'uint8'], [address.toLowerCase(), amount]).slice(2), 'hex');
  };

  (async () => {
    signers = await ethers.getSigners();

    bcf = signers[0];
    artist = signers[1];
    members = signers.slice(2, 10);
    nonmembers = signers.slice(11, 13);
    recipient = signers[14];
    membersList = members.map((m) => m.address);
    balances.forEach((item, index) => {
      whitelist[membersList[index]] = item;
    });

    let redeemLeafNodes = Object.entries(whitelist).map((item) => hashEntry(...item));
    let presaleLeafNodes = membersList.map((item) => keccak256(item));
    redeemMerkleTree = new MerkleTree(redeemLeafNodes, keccak256, { sortPairs: true });
    presaleMerkleTree = new MerkleTree(presaleLeafNodes, keccak256, { sortPairs: true });
    redeemRootHash = redeemMerkleTree.getRoot();
    presaleRootHash = presaleMerkleTree.getRoot();
  })();

  it('Should Deploy the Smart Contract', async () => {
    const SALE_START = Math.floor((Date.now() + halfDay * 1000) / 1000);
    const catFactory = await ethers.getContractFactory('MutantBioMorphans');
    const tokenFactory = await ethers.getContractFactory('ERC20');
    erc20contract = await tokenFactory.deploy('USDT', 'USDT');

    contract = await catFactory.deploy(
      SALE_START,
      SALE_START + oneDay,
      SALE_START + oneDay,
      baseContractURI,
      tokenSuffixURI,
      provenanceHash,
      [bcf.address, artist.address],
      [2000, 8000],
      _proxyAddress
    );
  });

  it('Should check intial contract sale values', async () => {
    expect(await contract.MAX_TOKENS()).to.equal(maxToken);

    expect(await contract.RESERVED_GIVEAWAYS()).to.equal(giveawayLimit);

    expect(await contract.MINT_BATCH_LIMIT()).to.equal(5);

    expect(await contract.SALE_PRICE()).to.equal('65000000000000000');
  });

  // it('Should check start and end date for the sale phases', async () => {
  //   const currentBlockNum = await ethers.provider.getBlockNumber();
  //   const currentBlock = await ethers.provider.getBlock(currentBlockNum);
  //   const currentTimestamp = currentBlock.timestamp;

  //   // Check sale start and end times (within a margin of 3 seconds)

  //   expect((await contract.privatesaleStartsAt()).toNumber()).to.closeTo(currentTimestamp + halfDay, 5);
  //   expect((await contract.privatesaleEndsAt()).toNumber()).to.closeTo(currentTimestamp + 2 * halfDay, 5);
  //   expect((await contract.publicsaleStartsAt()).toNumber()).to.closeTo(currentTimestamp + 2 * halfDay, 5);
  // });

  it('Should check that initial sale status is not active', async () => {
    expect(await contract.saleActive()).to.be.equals(false);
  });

  it('Should verify that deployer is actual owner', async () => {
    expect(await contract.owner()).to.equal(bcf.address);
  });

  it("Should check that non owners can't set sale to active", async () => {
    await expect(contract.connect(artist).changeSaleStatus()).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check reading the correct provenance hash', async () => {
    expect(await contract.PROVENANCE_HASH()).to.equal(provenanceHash);
  });

  it('Should check owner setting a new provenance hash', async () => {
    const newHash = '9b941d8e038d49895ad2635b2ad1ebf4776793490cfde977f17c8c57d4d665ff';
    const currentHash = await contract.PROVENANCE_HASH();

    await expect(contract.connect(bcf).setProvenanceHash(newHash))
      .to.emit(contract, 'ProvenanceHashSet')
      .withArgs(bcf.address, currentHash, newHash);

    expect(await contract.PROVENANCE_HASH()).to.equal(newHash);
  });

  it('Should check only owner can set the provenance hash', async () => {
    const newHash = '9b941d8e038d49895ad2635b2ad1ebf4776793490cfde977f17c8c57d4d665ff';

    await expect(contract.connect(artist).setProvenanceHash(newHash)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check owner can set the presale merkle tree root hash', async () => {
    expect(contract.connect(bcf).setWhitelistMerkleRoot(presaleRootHash));
  });

  it('Should check owner can set the redeem merkle tree root hash', async () => {
    expect(contract.connect(bcf).setRedeemMerkleRoot(redeemRootHash));
  });

  it('Should check only owner can set the presale merkle tree hash', async () => {
    await expect(contract.connect(artist).setWhitelistMerkleRoot(presaleRootHash)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check only owner can set the redeem merkle tree hash', async () => {
    await expect(contract.connect(artist).setRedeemMerkleRoot(redeemRootHash)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it("Should check that a non recipient can't change the withdraw address", async () => {
    await expect(contract.connect(recipient).changeWithdrawAddress(recipient.address)).to.be.revertedWith('The sender is not a recipient.');
  });

  it('Should check that a split recipient can change the withdraw address', async () => {
    await expect(contract.connect(bcf).changeWithdrawAddress(recipient.address))
      .to.emit(contract, 'WithdrawAddressChanged')
      .withArgs(bcf.address, recipient.address);
  });

  it('Should check that contracts supports ERC165 interface', async () => {
    const ERC165Interface = '0x01ffc9a7';
    expect(await contract.supportsInterface(ERC165Interface)).to.equal(true);
  });

  it('Should check that contracts supports ERC165 interface', async () => {
    const ERC165Interface = '0x01ffc9a7';
    expect(await contract.supportsInterface(ERC165Interface)).to.equal(true);
  });

  it('Should check that contracts supports ERC721 interface', async () => {
    const ERC721Interface = '0x80ac58cd';
    expect(await contract.supportsInterface(ERC721Interface)).to.equal(true);
  });

  it('Should check that contracts supports ERC721-Metadata interface', async () => {
    const MetadataInterface = '0x5b5e139f';
    expect(await contract.supportsInterface(MetadataInterface)).to.equal(true);
  });

  it('Should check that contracts supports ERC721-Enuemrable interface', async () => {
    const MetadataInterface = '0x780e9d63';
    expect(await contract.supportsInterface(MetadataInterface)).to.equal(true);
  });

  it('Should check that contracts supports IERC2981 interface', async () => {
    const IERC2981Interface = '0x2a55205a';
    expect(await contract.supportsInterface(IERC2981Interface)).to.equal(true);
  });

  it('Should check getting IERC2981 royalty info', async () => {
    const royaltyInfo = await contract.royaltyInfo(0, 100);
    expect(royaltyInfo.receiver).to.equals(contract.address);
    expect(royaltyInfo.royaltyAmount.toNumber()).to.equals(5);
  });

  it('Should check setting IERC2981 royalty info', async () => {
    await contract.setRoyalty(1000);
    const royaltyInfo = await contract.royaltyInfo(0, 100);
    expect(royaltyInfo.receiver).to.equals(contract.address);
    expect(royaltyInfo.royaltyAmount.toNumber()).to.equals(10);
  });

  it("Should check can't set IERC2981 royalty info above 10%", async () => {
    await expect(contract.connect(bcf).setRoyalty(1001)).to.be.revertedWith('Royalty must be between 0% and 10%.');
  });

  it('Should check only owner can set IERC2981 royalty info', async () => {
    await expect(contract.connect(artist).setRoyalty(1000)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check reading correct contract URI', async () => {
    expect(await contract.contractURI()).to.be.equals(baseContractURI + 'contract' + tokenSuffixURI);
  });

  it('Should check only owner can set baseURI', async () => {
    await expect(contract.connect(artist).setBaseURI(postRevealBaseContractURI)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check query metadata for non existing tokens reverts', async () => {
    await expect(contract.tokenURI(1)).to.be.revertedWith('ERC721Metadata: URI query for nonexistent token');
  });

  it('Should check owner can set baseURI', async () => {
    await contract.connect(bcf).setBaseURI(postRevealBaseContractURI);
    expect(await contract.contractURI()).to.be.equals(postRevealBaseContractURI + 'contract' + tokenSuffixURI);
  });

  // it("Should check owner can't exceed max of giveaway nfts", async () => {
  //   await expect(contract.connect(bcf).mintGiveawayNFT(members[0].address, 6)).to.be.revertedWith('All Giveaways Redeemed');
  // });

  // it('Should check owner can mint rest of giveaway nfts', async () => {
  //   await expect(contract.connect(bcf).mintGiveawayNFT(members[0].address, 5))
  //     .to.emit(contract, 'TokenMinted')
  //     .withArgs(members[0].address, 5);
  // });

  it('Should check owner can change sale status to active', async () => {
    await expect(contract.connect(bcf).changeSaleStatus()).to.emit(contract, 'SaleStatusChange').withArgs(bcf.address, true);
    expect(await contract.saleActive()).to.be.equals(true);
  });

  it("Should check members can't redeem before start of sale ", async () => {
    const hash = keccak256(members[0].address);

    const proof = redeemMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[0]).mintGiveawayNFT(proof, balances[0])).to.be.revertedWith('Sale not active');
  });

  it("Should check members can't mint for presale before start of sale ", async () => {
    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(members[0].address);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(
      contract.connect(members[0]).mintPrivateSale(balances[0], proof, { value: salePrice.mul(balances[0]) })
    ).to.be.revertedWith('Sale not active');
  });

  it('Should check whitelisted members minting in presale ', async () => {
    // Fast forward to start of presalE
    await ethers.provider.send('evm_increaseTime', [halfDay]);
    await ethers.provider.send('evm_mine', []);

    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(members[0].address);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[0]).mintPrivateSale(balances[0], proof, { value: salePrice.mul(balances[0]) }))
      .to.emit(contract, 'TokenMinted')
      .withArgs(members[0].address, balances[0]);

    numTokensMinted += balances[0];
  });

  it('Should check token metadata points to correct url', async () => {
    const tokenId = 1;
    expect(await contract.tokenURI(tokenId)).to.be.equal(postRevealBaseContractURI + tokenId + tokenSuffixURI);
  });

  it('Should check minted presale tokens can be transferred ', async () => {
    await expect(contract.connect(members[0]).transferFrom(members[0].address, members[1].address, 1))
      .to.emit(contract, 'Transfer')
      .withArgs(members[0].address, members[1].address, 1);
  });

  it('Should check failed redeem for wrong merkle proof', async () => {
    const invalidHash = hashEntry(members[0].address, balances[0]);

    const invalidProof = presaleMerkleTree.getHexProof(invalidHash);

    await expect(contract.connect(members[1]).mintGiveawayNFT(invalidProof, balances[1])).to.be.revertedWith('Restricted Access');
  });

  it('Should check minting giveaway nfts', async () => {
    const hash = hashEntry(members[0].address, balances[0]);

    const proof = redeemMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[0]).mintGiveawayNFT(proof, balances[0]))
      .to.emit(contract, 'TokenMinted')
      .withArgs(members[0].address, balances[0]);

    numTokensMinted += balances[0];
  });

  it('Should check a user that had redeemed', async () => {
    expect(await contract.giveawayRedeemed(members[0].address)).to.equal(true);
  });

  it("Should check user can't redeem twice", async () => {
    const hash = hashEntry(members[0].address, balances[0]);

    const proof = redeemMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[0]).mintGiveawayNFT(proof, balances[0])).to.be.revertedWith('Already redeemed');
  });

  it('Should check correct remaining supply', async () => {
    const salePrice = await contract.SALE_PRICE();

    expect(await contract.getRemSaleSupply()).to.be.equals(maxToken + giveawayLimit - numTokensMinted);
  });

  it('Should check failed presale minting for wrong merkle proof', async () => {
    const salePrice = await contract.SALE_PRICE();

    const invalidHash = keccak256(members[0].address);

    const invalidProof = presaleMerkleTree.getHexProof(invalidHash);

    await expect(
      contract.connect(members[1]).mintPrivateSale(balances[1], invalidProof, { value: salePrice.mul(balances[1]) })
    ).to.be.revertedWith('Restricted Access');
  });

  it('Should check failed presale minting for insufficient ETH amount sent', async () => {
    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(members[1].address);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[1]).mintPrivateSale(balances[1], proof, { value: salePrice })).to.be.revertedWith(
      'Insufficient ETH'
    );
  });

  it('Should check failing for minting above batch limit ', async () => {
    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(membersList[1]);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[1]).mintPrivateSale(6, proof, { value: salePrice.mul(6) })).to.be.revertedWith(
      'Invalid Num Token'
    );
  });

  it('Should check owner can pause and unpause presale', async () => {
    await expect(contract.connect(bcf).changeSaleStatus()).to.emit(contract, 'SaleStatusChange').withArgs(bcf.address, false);

    expect(await contract.saleActive()).to.be.equals(false);

    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(membersList[1]);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[1]).mintPrivateSale(5, proof, { value: salePrice.mul(5) })).to.be.revertedWith('Sale not active');

    await expect(contract.connect(bcf).changeSaleStatus()).to.emit(contract, 'SaleStatusChange').withArgs(bcf.address, true);

    expect(await contract.saleActive()).to.be.equals(true);
  });

  it('Should check minting more in presale ', async () => {
    const salePrice = await contract.SALE_PRICE();
    for (var i = 0; i < 40; i++) {
      const hash = keccak256(membersList[i % 8]);

      const proof = presaleMerkleTree.getHexProof(hash);

      await expect(contract.connect(members[i % 8]).mintPrivateSale(balances[i % 8], proof, { value: salePrice.mul(balances[i % 8]) }))
        .to.emit(contract, 'TokenMinted')
        .withArgs(membersList[i % 8], balances[i % 8]);

      numTokensMinted += balances[i % 8];
    }
  });

  it('Should check correct remaining presale supply as presale ends', async () => {
    const salePrice = await contract.SALE_PRICE();

    expect(await contract.getRemSaleSupply()).to.be.equals(maxToken + giveawayLimit - numTokensMinted);
  });

  it('Should check withdrawing right amounts from contract', async () => {
    const salePrice = await contract.SALE_PRICE();
    await expect(contract.connect(bcf).withdraw())
      .to.emit(contract, 'ContractWithdraw')
      .withArgs(bcf.address, salePrice.mul(numTokensMinted - 5));
  });

  it('Should check correct totalSupply after presale and giveaway minted', async () => {
    expect(await contract.totalSupply()).to.be.equals(numTokensMinted);
  });

  it('Should check no minting for public sale before public sale starts', async () => {
    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(5, { value: salePrice.mul(balances[0]) })).to.be.revertedWith(
      'Sale not active'
    );
  });

  it('Should check owner can not mint nfts before public sale starts', async () => {
    await expect(contract.mintNFT(members[0].address, 1)).to.be.revertedWith('Sale not active');
  });

  it('Should check members minting in public sale ', async () => {
    // Fast forward to start of sale Day 2
    await ethers.provider.send('evm_increaseTime', [2 * halfDay]);
    await ethers.provider.send('evm_mine', []);

    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(5, { value: salePrice.mul(5) }))
      .to.emit(contract, 'TokenMinted')
      .withArgs(members[0].address, 5);

    numTokensMinted += 5;
  });

  it('Should check minted presale tokens can be transferred ', async () => {
    await expect(contract.connect(members[0]).transferFrom(members[0].address, members[1].address, 213))
      .to.emit(contract, 'Transfer')
      .withArgs(members[0].address, members[1].address, 213);
  });

  it('Should check members minting in public sale ', async () => {
    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(3, { value: salePrice.mul(3) }))
      .to.emit(contract, 'TokenMinted')
      .withArgs(members[0].address, 3);

    numTokensMinted += 3;
  });

  it('Should check no presale minting after public sale starts', async () => {
    const salePrice = await contract.SALE_PRICE();

    const hash = keccak256(membersList[1]);

    const proof = presaleMerkleTree.getHexProof(hash);

    await expect(
      contract.connect(members[1]).mintPrivateSale(balances[1], proof, { value: salePrice.mul(balances[1]) })
    ).to.be.revertedWith('Private sale over');
  });

  it('Should check correct remaining public supply', async () => {
    const salePrice = await contract.SALE_PRICE();

    expect(await contract.getRemSaleSupply()).to.be.equals(maxToken + giveawayLimit - numTokensMinted);
  });

  it("Should check can't mint more than max batch threshold in public supply", async () => {
    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(6, { value: salePrice.mul(6) })).to.be.revertedWith('Wrong Num Token');
  });

  it("Should check can't mint if not enough ETH sent", async () => {
    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(5, { value: salePrice.mul(4) })).to.be.revertedWith('Insufficient ETH');
  });

  it('Should check owner can pause and unpause public sale', async () => {
    await expect(contract.connect(bcf).changeSaleStatus()).to.emit(contract, 'SaleStatusChange').withArgs(bcf.address, false);

    expect(await contract.saleActive()).to.be.equals(false);

    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[1]).mintPublicSale(5, { value: salePrice.mul(5) })).to.be.revertedWith('Sale not active');

    await expect(contract.connect(bcf).changeSaleStatus()).to.emit(contract, 'SaleStatusChange').withArgs(bcf.address, true);

    expect(await contract.saleActive()).to.be.equals(true);
  });

  it('Should check correct remaining sale supply', async () => {
    expect(await contract.getRemSaleSupply()).to.be.equals(982);
  });

  it('Should check minting the entire public supply', async () => {
    const salePrice = await contract.SALE_PRICE();
    for (var i = 0; i < 194; i++) {
      await expect(contract.connect(members[0]).mintPublicSale(5, { value: salePrice.mul(5) }))
        .to.emit(contract, 'TokenMinted')
        .withArgs(members[0].address, 5);

      numTokensMinted += 5;
    }

    expect(await contract.getRemSaleSupply()).to.be.equals(maxToken + giveawayLimit - numTokensMinted);
  });

  it('Should check minting giveaway nfts after sale is sold', async () => {
    const hash = hashEntry(members[1].address, balances[1]);

    const proof = redeemMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[1]).mintGiveawayNFT(proof, balances[1]))
      .to.emit(contract, 'TokenMinted')
      .withArgs(members[1].address, balances[1]);

    numTokensMinted += balances[1];
  });

  it("Should check can't exceed max of giveaway nfts", async () => {
    const hash = hashEntry(members[2].address, balances[2]);

    const proof = redeemMerkleTree.getHexProof(hash);

    await expect(contract.connect(members[2]).mintGiveawayNFT(proof, balances[2])).to.be.revertedWith('All Giveaways Redeemed');
  });

  it('Should check non owner can not mint left of public supply', async () => {
    await expect(contract.connect(members[0]).mintNFT(members[0].address, 7)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check owner minting left of public supply', async () => {
    await expect(contract.mintNFT(members[0].address, 7)).to.emit(contract, 'TokenMinted').withArgs(members[0].address, 7);
    numTokensMinted += 7;

    expect(await contract.getRemSaleSupply()).to.be.equals(0);
  });

  it('Should check owner can not mint nfts after all sold', async () => {
    await expect(contract.mintNFT(members[0].address, 1)).to.be.revertedWith('Sale sold');
  });

  it('Should check cannot mint left redeems', async () => {
    const salePrice = await contract.SALE_PRICE();
    await expect(contract.connect(members[0]).mintPublicSale(1, { value: salePrice.mul(1) })).to.be.revertedWith('Public sale sold');
  });

  it("Should check can't mint after all suplly minted", async () => {
    const salePrice = await contract.SALE_PRICE();

    await expect(contract.connect(members[0]).mintPublicSale(1, { value: salePrice.mul(1) })).to.be.revertedWith('Public sale sold');
  });

  it('Should check erc20 withdrawing from contract', async () => {
    const salePrice = await contract.SALE_PRICE();
    await expect(contract.connect(bcf).withdrawTokens(erc20contract.address))
      .to.emit(contract, 'ContractWithdrawToken')
      .withArgs(bcf.address, erc20contract.address, 0);
  });

  it('Should check change withdraw address to address 0x0 fails', async () => {
    await expect(contract.connect(bcf).changeWithdrawAddress('0x0000000000000000000000000000000000000000')).to.be.revertedWith(
      'Cannot use zero address'
    );
  });

  it('Should check change withdraw address to this contract address fails', async () => {
    await expect(contract.connect(bcf).changeWithdrawAddress(contract.address)).to.be.revertedWith('Cannot use this contract address');
  });

  it('Should check change withdraw address to a contract address fails', async () => {
    await expect(contract.connect(bcf).changeWithdrawAddress(erc20contract.address)).to.be.revertedWith(
      'Cannot set recipient to a contract address'
    );
  });

  it('Should check only owner can set proxy address', async () => {
    await expect(contract.connect(members[0]).setProxy(_proxyAddress, true)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should check isApprovedForAll for OpenSea proxy contract', async () => {
    expect(
      await contract.connect(members[0]).isApprovedForAll(members[0].address, '0xa5409ec958C83C3f309868babACA7c86DCB077c1')
    ).to.be.equals(true);
  });

  it('Should check owner can set and update proxy address', async () => {
    expect(contract.setProxy(_proxyAddress, false));
  });

  it('Should check isApprovedForAll for non registered proxy contract', async () => {
    expect(
      await contract.connect(members[0]).isApprovedForAll(members[0].address, '0xa5409ec958C83C3f309868babACA7c86DCB077c1')
    ).to.be.equals(false);
  });

  it('Should check random tokens level is 1', async () => {
    expect(await contract.tokenLevel(1)).to.be.equals(1);
    expect(await contract.tokenLevel(256)).to.be.equals(1);
    expect(await contract.tokenLevel(590)).to.be.equals(1);
    expect(await contract.tokenLevel(1149)).to.be.equals(1);
  });

  it('Should check tokens can not evolve if stage < 3', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice })).to.be.revertedWith('Can not evolve yet');
  });

  it('Should check owner advance stage to 2', async () => {
    await expect(contract.advanceStage()).to.emit(contract, 'TokenEvolved').withArgs(0, 2, bcf.address);
  });

  it('Should check random tokens level is 2', async () => {
    expect(await contract.tokenLevel(1)).to.be.equals(2);
    expect(await contract.tokenLevel(256)).to.be.equals(2);
    expect(await contract.tokenLevel(590)).to.be.equals(2);
    expect(await contract.tokenLevel(1149)).to.be.equals(2);
  });

  it('Should check tokens can not evolve if stage < 3', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice })).to.be.revertedWith('Can not evolve yet');
  });

  it('Should check owner advance stage to 3', async () => {
    await expect(contract.advanceStage()).to.emit(contract, 'TokenEvolved').withArgs(0, 3, bcf.address);
  });

  it('Should check random tokens level is 3', async () => {
    expect(await contract.tokenLevel(1)).to.be.equals(3);
    expect(await contract.tokenLevel(256)).to.be.equals(3);
    expect(await contract.tokenLevel(590)).to.be.equals(3);
    expect(await contract.tokenLevel(1149)).to.be.equals(3);
  });

  it('Should check owner can not advance stage > 3', async () => {
    await expect(contract.advanceStage()).to.be.revertedWith('Not permitted');
  });

  it('Should check can not evolve tokens for Insufficient ETH', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice.sub(1) })).to.be.revertedWith('Insufficient ETH');
  });

  it('Should check users can not evolve others tokens', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(1, { value: evolvePrice })).to.be.revertedWith('Access denied');
  });

  it('Should check owner able to evolve a token level 4', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice }))
      .to.emit(contract, 'TokenEvolved')
      .withArgs(6, 4, members[0].address);
  });

  it('Should check evolved tokens level is 4', async () => {
    expect(await contract.tokenLevel(6)).to.be.equals(4);
  });

  it('Should check owner able to evolve a token level 5', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice }))
      .to.emit(contract, 'TokenEvolved')
      .withArgs(6, 5, members[0].address);
  });

  it('Should check evolved tokens level is 5', async () => {
    expect(await contract.tokenLevel(6)).to.be.equals(5);
  });

  it('Should check can not evolve tokens levels higher > 5', async () => {
    const evolvePrice = await contract.EVOLVE_PRICE();

    await expect(contract.connect(members[0]).evolve(6, { value: evolvePrice })).to.be.revertedWith('Token Fully Evolved');
  });

  it('Should check owner able to change transfer inactive', async () => {
    await expect(contract.changeTransferStatus()).to.emit(contract, 'TransferStatusChange').withArgs(bcf.address, false);
  });

  it('Should check tranfer is inactive', async () => {
    expect(await contract.transferActive()).to.be.equals(false);
  });

  it('Should check tokens can not be transferred when transfer disabled', async () => {
    await expect(contract.connect(members[0]).transferFrom(members[0].address, members[1].address, 6)).to.be.revertedWith(
      'Transfer disabled'
    );
  });

  it('Should check tokens can not be transferred when transfer disabled with safeTransferFrom', async () => {
    await expect(
      contract.connect(members[0])['safeTransferFrom(address,address,uint256)'](members[0].address, members[1].address, 6)
    ).to.be.revertedWith('Transfer disabled');
  });

  it('Should check tokens can not be transferred when transfer disabled with safeTransferFrom with data', async () => {
    await expect(
      contract.connect(members[0])['safeTransferFrom(address,address,uint256,bytes)'](members[0].address, members[1].address, 6, [])
    ).to.be.revertedWith('Transfer disabled');
  });

  it('Should check owner able to change transfer back to active', async () => {
    await expect(contract.changeTransferStatus()).to.emit(contract, 'TransferStatusChange').withArgs(bcf.address, true);
  });

  it('Should check tranfer is active', async () => {
    expect(await contract.transferActive()).to.be.equals(true);
  });

  it('Should check tokens can be transferred after renabling transfer', async () => {
    await expect(contract.connect(members[0]).transferFrom(members[0].address, members[1].address, 6))
      .to.emit(contract, 'Transfer')
      .withArgs(members[0].address, members[1].address, 6);
  });

  it('Should check tokens can be transferred after renabling transfer in safeTransferFrom', async () => {
    await expect(contract.connect(members[1])['safeTransferFrom(address,address,uint256)'](members[1].address, members[0].address, 6))
      .to.emit(contract, 'Transfer')
      .withArgs(members[1].address, members[0].address, 6);
  });

  it('Should check tokens can be transferred after renabling transfer in safeTransferFrom with data', async () => {
    await expect(
      contract.connect(members[0])['safeTransferFrom(address,address,uint256,bytes)'](members[0].address, members[1].address, 6, [])
    )
      .to.emit(contract, 'Transfer')
      .withArgs(members[0].address, members[1].address, 6);
  });
});
