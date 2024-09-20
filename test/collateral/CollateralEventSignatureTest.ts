import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

describe('CollateralEventSignatureTest', function () {
  async function deployFixture() {
    const CollateralEventSignatureTest = await ethers.getContractFactory('CollateralEventSignatureTest');
    const collateralEventSignatureTest = await CollateralEventSignatureTest.deploy();
    return { collateralEventSignatureTest };
  }

  it('Should use valid collateral withdraw report event signature', async function () {
    const { collateralEventSignatureTest } = await loadFixture(deployFixture);
    await collateralEventSignatureTest.checkWithdrawReportEventSignature();
  });

  it('Should use valid collateral unlock report event signature', async function () {
    const { collateralEventSignatureTest } = await loadFixture(deployFixture);
    await collateralEventSignatureTest.checkUnlockReportEventSignature();
  });
});
