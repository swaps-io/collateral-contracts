export interface UnlockReport {
  variant: bigint;
  unlockChain: bigint;
  lockChain: bigint;
  account: string;
  unlockCounter: bigint;
}
