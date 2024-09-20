import { evm } from '../../scripts/lib/evm';

export const mockHashEventProof = async (sig: string, hash: string, chain: bigint): Promise<string> => {
  const proofData = await evm.abiEncode(['bytes32', 'bytes32', 'uint256'], [sig, hash, chain]);
  return proofData;
};
