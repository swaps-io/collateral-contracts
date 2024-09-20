import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-contract-sizer';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 1_000_000,
      },
    },
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: true,
    runOnCompile: true,
    strict: true,
    only: [
      'contracts/collateral/CollateralManager.sol',
      'contracts/collateral/CollateralBastion.sol',
      'contracts/whitelist/ApproveAccessWhitelistFossil.sol',
      'contracts/whitelist/ApproveAccessWhitelistOwned.sol',
    ],
  },
};

export default config;
