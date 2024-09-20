import { TransactionResponse, TransactionReceipt } from 'ethers';

type TransactionInfo = {
  tx: TransactionResponse,
  receipt: TransactionReceipt,
  gas: bigint,
}

export const printGasInfo = (target: string, gasUsed: bigint): void => {
  console.log(`Gas used to ${target}: ${gasUsed}`);
};

export const gasInfo = async (
  target: string,
  tx: TransactionResponse,
): Promise<TransactionInfo> => {
  const info = await gasInfoCore(tx);
  printGasInfo(target, info.receipt.gasUsed);
  return info;
};

export const gasInfoSilent = async (
  tx: TransactionResponse,
): Promise<TransactionInfo> => {
  return await gasInfoCore(tx);
};

const gasInfoCore = async (
  tx: TransactionResponse,
): Promise<TransactionInfo> => {
  const receipt = await tx.wait();
  if (receipt == null) {
    throw new Error('Empty transaction receipt');
  }

  const gas = receipt.gasUsed * receipt.gasPrice;
  return { tx, receipt, gas };
};
