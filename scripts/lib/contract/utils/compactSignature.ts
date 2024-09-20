import { CompactSignature, evm } from '../../evm';

export const toCompactSignature = async (signature: string): Promise<CompactSignature> => {
  const compactSignature = await evm.convertSignature(signature);
  return compactSignature;
};
