export enum Allowance {
  Revoked,
  ApprovedWeak, // Revokes when protocol is revoked by owner
  ApprovedStrong, // Doesn't revoke when protocol is revoked by owner
}
