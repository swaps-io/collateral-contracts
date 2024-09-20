import { evm } from '../../evm';

import { UnlockReport } from './unlockReport';

export const calcUnlockReportHash = async (report: UnlockReport): Promise<string> => {
  const reportHashData = await evm.abiEncode(
    ['uint256', 'uint256', 'uint256', 'address', 'uint256'],
    [report.variant, report.unlockChain, report.lockChain, report.account, report.unlockCounter],
  );
  const reportHash = await evm.keccak256(reportHashData);
  return reportHash;
};
