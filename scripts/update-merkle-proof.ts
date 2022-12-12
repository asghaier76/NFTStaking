import { BigNumber } from '@ethersproject/bignumber';
import { formatEther } from '@ethersproject/units';
import { ethers, deployments } from 'hardhat';
import { BabylonMisfits } from '../sdk/types/BabylonMisfits';
const fs = require('fs');

async function main() {
  const redeemMerkleTreeRoot: Buffer = Buffer.from('ac3a3c73fa7749a688eb139c79601e87642a15351bdd6aebb9d7169d4752f6e2', 'hex');
  const whitelistMerkleTreeRoot: Buffer = Buffer.from('2829232af525a759e0af28ab62514bab3980d4be8a2e4de797313ec82121f31b', 'hex');

  const signer = new ethers.Wallet('', ethers.provider);

  //   const signer = await ethers.getSigner('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  const contractDeploy = await deployments.get('BabylonMisfits');
  const contractInstance = (await ethers.getContractAt('BabylonMisfits', contractDeploy.address, signer)) as BabylonMisfits;

  const initialBalance: BigNumber = await signer.getBalance();

  let tx;

  await contractInstance.setRedeemMerkleRoot(redeemMerkleTreeRoot);
  tx = await contractInstance.setWhitelistMerkleRoot(whitelistMerkleTreeRoot);
  await tx.wait();

  console.log(await contractInstance.whitelistMerkleRoot());
  console.log(await contractInstance.redeemMerkleRoot());

  const currentBalance: BigNumber = await signer.getBalance();

  console.log(formatEther(initialBalance.sub(currentBalance)), ' total amount spent in txn');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
