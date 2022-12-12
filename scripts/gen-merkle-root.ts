import { MerkleTree } from 'merkletreejs';
import keccak256 = require('keccak256');
import * as fs from 'fs';
import { ethers } from 'ethers';

export function genMerkleRoot(collectionSlug: string, type: string): Buffer {
  let listAddresses: any = {};
  try {
    let rawdata = fs.readFileSync(`../../packages/cli/whitelists/${collectionSlug}.json`);
    listAddresses = JSON.parse(rawdata.toString());
  } catch (err) {
    // console.log(err);
  }

  let leafNodes =
    type === 'presale'
      ? Object.keys(listAddresses).map((key) => keccak256(key.toLowerCase()))
      : Object.entries(listAddresses).map((item) => hashEntry(...item));

  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

  // console.log('Merkle tree generated.');

  const rootHash = merkleTree.getRoot();

  console.log(`${type}RootHash`, rootHash.toString());
  console.log(`${type}RootHash`, rootHash);

  return rootHash;
}

function hashEntry(address: any, amount: any) {
  return Buffer.from(ethers.utils.solidityKeccak256(['address', 'uint8'], [address.toLowerCase(), amount]).slice(2), 'hex');
}
