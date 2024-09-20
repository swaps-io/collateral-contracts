export interface WithdrawReport {
  variant: bigint;
  lockChain: bigint;
  unlockChain: bigint;
  account: string;
  lockCounter: bigint;
  amount: bigint;
  nonce: bigint;
}
