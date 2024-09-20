import { ethers } from 'hardhat';

export const nowSeconds = async (): Promise<bigint> => {
  const block = await ethers.provider.getBlock('latest');
  if (block == null) {
    throw new Error('Empty latest block');
  }
  return BigInt(block.timestamp);
};

export const minutesToSeconds = (minutes: bigint): bigint => {
  return minutes * 60n;
};

export const hoursToMinutes = (hours: bigint): bigint => {
  return hours * 60n;
}

export const hoursToSeconds = (hours: bigint): bigint => {
  return minutesToSeconds(hoursToMinutes(hours));
};
