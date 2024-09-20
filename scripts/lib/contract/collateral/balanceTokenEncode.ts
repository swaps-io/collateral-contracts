import { BalanceToken } from './balanceToken';

const MAX_UINT160 = (1n << 160n) - 1n;

export const encodeBalanceTokens = async (tokens: BalanceToken[]): Promise<string[]> => {
  const tokenData = await Promise.all(tokens.map(encodeBalanceToken));
  return tokenData;
};

// eslint-disable-next-line @typescript-eslint/require-await
export const encodeBalanceToken = async (token: BalanceToken): Promise<string> => {
  const tokenData = fillAddressBits(token.address) | fillDecimalsBits(token.decimals);
  return tokenData.toString();
};

const fillAddressBits = (address: string): bigint => {
  const addressInt = BigInt(address);
  if (addressInt < 0n || addressInt > MAX_UINT160) {
    throw new Error('Invalid token address');
  }
  return addressInt << 8n;
};

const fillDecimalsBits = (decimals: number | bigint): bigint => {
  const decimalsInt = BigInt(decimals);
  if (decimalsInt < 0n || decimalsInt > 255n) {
    throw new Error('Invalid token decimals');
  }
  return decimalsInt;
};
