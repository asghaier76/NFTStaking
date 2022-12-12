import { LKStaking } from 'sdk/types/LKStaking';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func: any = async function (hre: HardhatRuntimeEnvironment): Promise<void> {
  const { ethers, deployments } = hre;
  const { getContractAt, utils } = ethers;
  const { formatEther } = utils;
  const { deploy, get } = deployments;
  const [sender] = await ethers.getSigners();

  /**
   * @dev Load all deployed contracts
   */
  async function getDeployedContracts(sender: SignerWithAddress): Promise<{
    LKStaking: LKStaking;
  }> {
    return {
      LKStaking: (await getContractAt('LKStaking', (await get('LKStaking')).address, sender)) as LKStaking,
    };
  }

  /**
   * @dev retrieve and display address, chain, balance
   */
  const Erc20Token_address = '';
  const bal = await sender.getBalance();
  const thisAddr = await sender.getAddress();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log(`balance ${chainId} ${thisAddr} : ${formatEther(bal)}`);

  // process.exit(0);

  type DeployParams = {
    args: string[] | number[];
    from: string;
    log: boolean;
  };
  const deployParams: DeployParams = {
    args: [],
    from: sender.address,
    log: true,
  };

  type DeployArgs = number | string | number[] | string[];

  function getParams(args: DeployArgs[]): DeployParams {
    return Object.assign({}, deployParams, { args });
  }

  /**
   * @dev Deploy all the contracts
   */
  console.log('deploying contracts...');

  const deployment: any = {};

  deployment.LKStaking = await deploy('LKStaking', getParams([Erc20Token_address]));

  // deploy complete!
  console.log('Deploy complete\n');
  const nbal = await sender.getBalance();
  console.log(`${chainId} ${thisAddr}: ${formatEther(nbal)}`);
  console.log(`spent: ${formatEther(bal.sub(nbal))}`);
};

func.tags = ['Deploy'];
func.dependencies = [];
export default func;
