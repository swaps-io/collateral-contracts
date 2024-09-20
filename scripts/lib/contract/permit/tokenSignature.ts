import { ITypedDataSigner, TypedDataDomain } from '../../evm';

import { TokenPermit } from './token';
import { TOKEN_PERMIT_TYPE } from './tokenTyped';

export const createTokenPermitSignature = async (
  domain: TypedDataDomain,
  tokenPermit: TokenPermit,
  signer: ITypedDataSigner,
): Promise<string> => {
  const signature = await signer.signTypedData(domain, TOKEN_PERMIT_TYPE, tokenPermit);
  return signature;
};
