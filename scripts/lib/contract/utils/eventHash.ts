import { evm } from '../../evm';

// The `hashArg` value corresponds to the 1st topic of the event.
// Note that `signature` is the 0th topic of event technically
export const calcEventHash = async (signature: string, hashArg: string): Promise<string> => {
  const eventHashData = await evm.abiEncode(['bytes32', 'bytes32'], [signature, hashArg]);
  const eventHash = await evm.keccak256(eventHashData);
  return eventHash;
};
