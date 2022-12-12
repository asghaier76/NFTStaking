import { task } from 'hardhat/config';

import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/types';

import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';

import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import 'hardhat-spdx-license-identifier';
import 'hardhat-contract-sizer';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import 'hardhat-watcher';

import '@nomiclabs/hardhat-solhint';
import 'solidity-coverage';
import '@nomiclabs/hardhat-etherscan';

export function chain_id(networkName: string): string {
  if (networkName) {
    const uri = process.env['CHAIN_ID_' + networkName.toUpperCase()];
    if (uri) {
      return uri;
    }
  }
  return '0';
}

export function node_url(networkName: string): string {
  if (networkName) {
    const uri = process.env['ETH_NODE_URI_' + networkName.toUpperCase()];
    if (uri && uri !== '') {
      return uri;
    }
  }

  let uri = process.env.ETH_NODE_URI;
  if (uri) {
    uri = uri.replace('{{networkName}}', networkName);
  }
  if (!uri || uri === '') {
    // throw new Error(`environment variable "ETH_NODE_URI" not configured `);
    return '';
  }
  if (uri.indexOf('{{') >= 0) {
    throw new Error(`invalid uri or network not supported by node eprovider : ${uri}`);
  }
  return uri;
}

export function getMnemonic(networkName?: string): string {
  if (networkName) {
    const mnemonic = process.env['MNEMONIC_' + networkName.toUpperCase()];
    if (mnemonic && mnemonic !== '') {
      return mnemonic;
    }
  }

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic || mnemonic === '') {
    return 'test test test test test test test test test test test junk';
  }
  return mnemonic;
}

export function accounts(networkName?: string): { mnemonic: string; accountsBalance: string } {
  return { mnemonic: getMnemonic(networkName), accountsBalance: '100000000000000000000000000' };
}

task('blockNumber', 'Prints the current block number', async (args, hre) => {
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  console.log('Current block number: ' + blockNumber);
});

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: '0.8.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
      kovan: 0,
    },
  },

  networks: {
    hardhat: {
      chainId: 1337,
      accounts: accounts('hardhat'),
    },
    localhost: {
      url: 'http://localhost:8545',
      accounts: accounts(),
      gasPrice: 'auto',
      gas: 'auto',
    },
    ftmtest: {
      url: node_url('ftmtest'),
      accounts: accounts('ftmtest'),
      gasPrice: 'auto',
      gas: 'auto',
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [`${process.env.WALLET_PRIVATE_KEY}`],
      gasPrice: 'auto',
      gas: 'auto',
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`,
      accounts: [`${process.env.WALLET_PRIVATE_KEY}`],
      gasPrice: 'auto',
      gas: 'auto',
    },
    opera: {
      url: node_url('opera'),
      accounts: accounts('opera'),
      gasPrice: 'auto',
      gas: 'auto',
      timeout: 30000,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    sources: 'contracts',
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 150,
    enabled: true,
    maxMethodDiff: 10,
  },
  mocha: {
    timeout: 0,
  },
  abiExporter: {
    path: './sdk/abi',
    clear: true,
    flat: true,
    runOnCompile: true,
    // only: [':ERC20$'],
    spacing: 2,
  },
  typechain: {
    outDir: './sdk/types',
    target: 'ethers-v5',
  },
};

export default config;
