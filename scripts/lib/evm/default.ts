import { EthersEvmProvider } from './impl/ethers';
import { IEvmProvider } from './interface';

export const DEFAULT_EVM: IEvmProvider = new EthersEvmProvider();
