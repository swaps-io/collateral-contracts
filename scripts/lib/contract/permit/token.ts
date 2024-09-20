export interface TokenPermit {
  owner: string;
  spender: string;
  value: bigint;
  nonce: bigint;
  deadline: bigint;
}
