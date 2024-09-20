import { ethers } from 'hardhat';
import { getCreateAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { encodeBalanceTokens } from '../../scripts/lib/contract/collateral/balanceTokenEncode';
import { calcWithdrawReportHash } from '../../scripts/lib/contract/collateral/withdrawReportHash';
import { WithdrawReport } from '../../scripts/lib/contract/collateral/withdrawReport';
import { calcUnlockReportHash } from '../../scripts/lib/contract/collateral/unlockReportHash';
import { UnlockReport } from '../../scripts/lib/contract/collateral/unlockReport';
import {
  UNLOCK_REPORT_EVENT_SIGNATURE,
  WITHDRAW_REPORT_EVENT_SIGNATURE,
} from '../../scripts/lib/contract/collateral/eventSignature';
import { STABLECOIN_COLLATERAL_VARIANT } from '../../scripts/lib/contract/collateral/variant';

import { Allowance } from '../../scripts/lib/contract/whitelist/approve-access/allowance';

import { TokenPermit } from '../../scripts/lib/contract/permit/token';
import { createTokenPermitSignature } from '../../scripts/lib/contract/permit/tokenSignature';

import { toCompactSignature } from '../../scripts/lib/contract/utils/compactSignature';
import { calcEventHash } from '../../scripts/lib/contract/utils/eventHash';

import { TypedDataDomain } from '../../scripts/lib/evm';

import { gasInfo } from '../common/gas';
import { expectLog } from '../common/log';
import { hoursToSeconds, nowSeconds } from '../common/time';
import { ANOTHER_CHAIN_ID, OTHER_CHAIN_ID, TEST_CHAIN_ID } from '../common/chainId';
import { mockHashEventProof } from '../common/proofMock';
import { expectRevert } from '../common/revert';

describe('CollateralManagerTest', function () {
  async function deployFixture() {
    const [ownerAccount, otherAccount, anotherAccount] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory('TestToken');
    const balanceToken = await TestToken.deploy();
    const balanceTokenAddress = await balanceToken.getAddress();

    const balanceDecimals = 18;
    const balanceTokenData = await encodeBalanceTokens([
      {
        address: balanceTokenAddress,
        decimals: await balanceToken.decimals(),
      },
    ]);

    const ProofVerifierMock = await ethers.getContractFactory('ProofVerifierMock');
    const proofVerifier = await ProofVerifierMock.deploy();

    const accountNonce = await ownerAccount.getNonce();
    const collateralManagerAddress = getCreateAddress({ from: ownerAccount.address, nonce: accountNonce + 1 });

    const ApproveAccessWhitelistOwned = await ethers.getContractFactory('ApproveAccessWhitelistOwned');
    const accessWhitelist = await ApproveAccessWhitelistOwned.deploy(ownerAccount); // accountNonce + 0

    const CollateralManager = await ethers.getContractFactory('CollateralManager');
    const collateralManager = await CollateralManager.deploy( // accountNonce + 1
      balanceDecimals,
      balanceTokenData,
      STABLECOIN_COLLATERAL_VARIANT,
      proofVerifier,
      accessWhitelist,
    );
    expect(await collateralManager.getAddress()).to.be.equal(collateralManagerAddress);

    return {
      accounts: {
        owner: ownerAccount,
        other: otherAccount,
        another: anotherAccount,
      },
      balanceToken,
      balanceTokenAddress,
      proofVerifier,
      accessWhitelist,
      collateralManager,
    };
  }

  it('Should have zero balance for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
    expect(balance).to.be.equal(0n);
  });

  it('Should have zero balance of any specific token for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts, balanceToken } = await loadFixture(deployFixture);

    const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceToken);
    expect(balanceByToken).to.be.equal(0n);
  });

  it('Should have zero unlock counter for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
    expect(unlockCounter).to.be.equal(0n);
  });

  it('Should have zero unlock withdraw nonce for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
    expect(unlockWithdrawNonce).to.be.equal(0n);
  });

  it('Should have zero lock counter for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
    expect(lockCounter).to.be.equal(0n);
  });

  it('Should have zero lock withdraw nonce for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
    expect(lockWithdrawNonce).to.be.equal(0n);
  });

  it('Should have zero external unlock counter for any account and lock chain after deploy', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
    expect(externalUnlockCounter).to.be.equal(0n);
  });

  it('Should accept and count deposit with balance token via approve', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 123_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 123_456_789n);

    const { tx, receipt } = await gasInfo(
      'call deposit (via approve, full amount, first time)',
      await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 123_456_789n, OTHER_CHAIN_ID),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'Deposit', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(123_456_789_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(123_456_789_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(123_456_789_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(123_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should accept and count deposit with balance token via permit', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 123_456_789n);

    const permitDeadline = await nowSeconds() + hoursToSeconds(1n);
    const tokenPermit: TokenPermit = {
      owner: accounts.other.address,
      spender: await collateralManager.getAddress(),
      value: 123_456_789n,
      nonce: 0n,
      deadline: permitDeadline,
    };
    const permitDomain: TypedDataDomain = {
      name: await balanceToken.name(),
      version: '1',
      chainId: TEST_CHAIN_ID,
      verifyingContract: balanceTokenAddress,
    };
    const permitSignature = await toCompactSignature(await createTokenPermitSignature(permitDomain, tokenPermit, accounts.other));

    const { tx, receipt } = await gasInfo(
      'call deposit (via permit, multicall, full amount, first time)',
      await collateralManager.connect(accounts.other).multicall([
        collateralManager.interface.encodeFunctionData('permit', [
          accounts.other.address,
          balanceTokenAddress,
          123_456_789n,
          permitDeadline,
          permitSignature.r,
          permitSignature.vs,
        ]),
        collateralManager.interface.encodeFunctionData('deposit', [
          balanceTokenAddress,
          123_456_789n,
          OTHER_CHAIN_ID,
        ]),
      ]),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'Deposit', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(123_456_789_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(123_456_789_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(123_456_789_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(123_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should accept and count three deposits with balance token via permit', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 322_456_789n);

    const permitDeadline = await nowSeconds() + hoursToSeconds(1n);
    const tokenPermit: TokenPermit = {
      owner: accounts.other.address,
      spender: await collateralManager.getAddress(),
      value: 322_456_789n,
      nonce: 0n,
      deadline: permitDeadline,
    };
    const permitDomain: TypedDataDomain = {
      name: await balanceToken.name(),
      version: '1',
      chainId: TEST_CHAIN_ID,
      verifyingContract: balanceTokenAddress,
    };
    const permitSignature = await toCompactSignature(await createTokenPermitSignature(permitDomain, tokenPermit, accounts.other));

    const { tx, receipt } = await gasInfo(
      'call deposit (via permit, multicall, partial amount, two first time, one second time)',
      await collateralManager.connect(accounts.other).multicall([
        collateralManager.interface.encodeFunctionData('permit', [
          accounts.other.address,
          balanceTokenAddress,
          322_456_789n,
          permitDeadline,
          permitSignature.r,
          permitSignature.vs,
        ]),
        collateralManager.interface.encodeFunctionData('deposit', [
          balanceTokenAddress,
          123_456_789n,
          OTHER_CHAIN_ID,
        ]),
        collateralManager.interface.encodeFunctionData('deposit', [
          balanceTokenAddress,
          99_666_777n,
          OTHER_CHAIN_ID,
        ]),
        collateralManager.interface.encodeFunctionData('deposit', [
          balanceTokenAddress,
          1_222_333n,
          ANOTHER_CHAIN_ID,
        ]),
      ]),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'Deposit', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(123_456_789_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });
    expectLog({
      contract: collateralManager, tx, receipt, name: 'Deposit', index: 1, check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(99_666_777_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });
    expectLog({
      contract: collateralManager, tx, receipt, name: 'Deposit', index: 2, check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(1_222_333_000_000_000_000n);
        expect(data.lockChain).to.be.equal(ANOTHER_CHAIN_ID);
      },
    });

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(223_123_566_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(223_123_566_000_000_000_000n);
  
      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(223_123_566_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }

    {
      const balance = await collateralManager.balance(accounts.other, ANOTHER_CHAIN_ID);
      expect(balance).to.be.equal(1_222_333_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, ANOTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(1_222_333_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(1_222_333_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, ANOTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, ANOTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow withdraw of balance token if lock counter is insufficient', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 123_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 123_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 123_456_789n, OTHER_CHAIN_ID);

    const withdrawReport: WithdrawReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      lockChain: OTHER_CHAIN_ID,
      unlockChain: TEST_CHAIN_ID,
      account: accounts.other.address,
      lockCounter: 130_000_000_000_000_000_000n,
      amount: 30_000_000_000_000_000_000n,
      nonce: 0n,
    };
    const reportHash = await calcWithdrawReportHash(withdrawReport);
    const reportProof = await mockHashEventProof(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

    await expectRevert(
      collateralManager.connect(accounts.other).withdraw(
        balanceTokenAddress,
        30_000_000_000_000_000_000n,
        OTHER_CHAIN_ID,
        130_000_000_000_000_000_000n,
        reportProof,
      ),
      { customError: 'WithdrawRefusal()' },
    );
  });

  it('Should allow withdraw of balance token if lock counter is sufficient', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress, proofVerifier } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 123_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 123_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 123_456_789n, OTHER_CHAIN_ID);

    const withdrawReport: WithdrawReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      lockChain: OTHER_CHAIN_ID,
      unlockChain: TEST_CHAIN_ID,
      account: accounts.other.address,
      lockCounter: 120_000_000_000_000_000_000n,
      amount: 30_000_000_000_000_000_000n,
      nonce: 0n,
    };
    const reportHash = await calcWithdrawReportHash(withdrawReport);
    const reportProof = await mockHashEventProof(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

    const { tx, receipt } = await gasInfo(
      'call withdraw (partial amount, first time)',
      await collateralManager.connect(accounts.other).withdraw(
        balanceTokenAddress,
        30_000_000_000_000_000_000n,
        OTHER_CHAIN_ID,
        120_000_000_000_000_000_000n,
        reportProof,
      ),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'Withdraw', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(30_000_000_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });

    const verifiedProofCount = await proofVerifier.verifiedProofCount();
    expect(verifiedProofCount).to.be.equal(1n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(93_456_789_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(93_456_789_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(123_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(1n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should allow three withdraws of balance token if lock counter is sufficient', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress, proofVerifier } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 123_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 123_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 120_000_000n, OTHER_CHAIN_ID);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 3_456_789n, ANOTHER_CHAIN_ID);

    let withdrawCalls: string[] = [];
    {
      const withdrawReport: WithdrawReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        lockChain: OTHER_CHAIN_ID,
        unlockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        lockCounter: 30_000_000_000_000_000_000n,
        amount: 30_000_000_000_000_000_000n,
        nonce: 0n,
      };
      const reportHash = await calcWithdrawReportHash(withdrawReport);
      const reportProof = await mockHashEventProof(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      const withdrawData = collateralManager.interface.encodeFunctionData(
        'withdraw',
        [
          balanceTokenAddress,
          30_000_000_000_000_000_000n,
          OTHER_CHAIN_ID,
          30_000_000_000_000_000_000n,
          reportProof,
        ],
      );
      withdrawCalls.push(withdrawData);
    }
    {
      const withdrawReport: WithdrawReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        lockChain: OTHER_CHAIN_ID,
        unlockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        lockCounter: 120_000_000_000_000_000_000n,
        amount: 90_000_000_000_000_000_000n,
        nonce: 1n,
      };
      const reportHash = await calcWithdrawReportHash(withdrawReport);
      const reportProof = await mockHashEventProof(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      const withdrawData = collateralManager.interface.encodeFunctionData(
        'withdraw',
        [
          balanceTokenAddress,
          90_000_000_000_000_000_000n,
          OTHER_CHAIN_ID,
          120_000_000_000_000_000_000n,
          reportProof,
        ],
      );
      withdrawCalls.push(withdrawData);
    }
    {
      const withdrawReport: WithdrawReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        lockChain: ANOTHER_CHAIN_ID,
        unlockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        lockCounter: 3_456_789_000_000_000_000n,
        amount: 3_456_789_000_000_000_000n,
        nonce: 0n,
      };
      const reportHash = await calcWithdrawReportHash(withdrawReport);
      const reportProof = await mockHashEventProof(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash, ANOTHER_CHAIN_ID);

      const withdrawData = collateralManager.interface.encodeFunctionData(
        'withdraw',
        [
          balanceTokenAddress,
          3_456_789_000_000_000_000n,
          ANOTHER_CHAIN_ID,
          3_456_789_000_000_000_000n,
          reportProof,
        ],
      );
      withdrawCalls.push(withdrawData);
    }

    const { tx, receipt } = await gasInfo(
      'call withdraw (multicall, full amount, two first time, one second time)',
      await collateralManager.connect(accounts.other).multicall(withdrawCalls),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'Withdraw', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(30_000_000_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });
    expectLog({
      contract: collateralManager, tx, receipt, name: 'Withdraw', index: 1, check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(90_000_000_000_000_000_000n);
        expect(data.lockChain).to.be.equal(OTHER_CHAIN_ID);
      },
    });
    expectLog({
      contract: collateralManager, tx, receipt, name: 'Withdraw', index: 2, check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.token).to.be.equal(balanceTokenAddress);
        expect(data.amount).to.be.equal(3_456_789_000_000_000_000n);
        expect(data.lockChain).to.be.equal(ANOTHER_CHAIN_ID);
      },
    });

    const verifiedProofCount = await proofVerifier.verifiedProofCount();
    expect(verifiedProofCount).to.be.equal(3n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(120_000_000_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(2n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }

    {
      const balance = await collateralManager.balance(accounts.other, ANOTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, ANOTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(3_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, ANOTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(1n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, ANOTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, ANOTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow skip withdraw nonces out of range', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      collateralManager.connect(accounts.other).skipWithdraw(OTHER_CHAIN_ID, 1, 1),
      { customError: 'InvalidWithdrawSkip()' },
    );
  });

  it('Should allow skip one withdraw nonce', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await gasInfo(
      'call skipWithdraw(one nonce, first time)',
      await collateralManager.connect(accounts.other).skipWithdraw(OTHER_CHAIN_ID, 0, 0),
    );

    const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
    expect(unlockWithdrawNonce).to.be.equal(1n);
  });

  it('Should allow skip seven withdraw nonces', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await gasInfo(
      'call skipWithdraw(seven nonces, first time)',
      await collateralManager.connect(accounts.other).skipWithdraw(OTHER_CHAIN_ID, 0, 6),
    );

    const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
    expect(unlockWithdrawNonce).to.be.equal(7n);
  });

  it('Should allow skip withdraw nonces multiple times', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await collateralManager.connect(accounts.other).skipWithdraw(OTHER_CHAIN_ID, 0, 6);

    await gasInfo(
      'call skipWithdraw(four nonces, second time)',
      await collateralManager.connect(accounts.other).skipWithdraw(OTHER_CHAIN_ID, 7, 10),
    );

    const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
    expect(unlockWithdrawNonce).to.be.equal(11n);
  });

  it('Should not allow commit lock by protocol with no access granted by whitelist', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 119_322n),
      { customError: 'UnauthorizedLockAccess(.*)' },
    );
  });

  it('Should not allow commit first lock if unlock counter is insufficient', async function () {
    const { collateralManager, accounts, accessWhitelist } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await expectRevert(
      collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 119_322n),
      { customError: 'LockRefusal()' },
    );
  });

  it('Should allow commit first lock if unlock counter is sufficient', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await gasInfo(
      'call commitLock (first time)',
      await collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 119_420n),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(119_420n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow commit second lock if unlock counter is insufficient', async function () {
    const { collateralManager, accounts, accessWhitelist } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 119_420n),

    await expectRevert(
      collateralManager.connect(accounts.another).commitLock(accounts.other, 12_345n, OTHER_CHAIN_ID, 130_000n),
      { customError: 'LockRefusal()' },
    );
  });

  it('Should allow commit second lock if unlock counter is sufficient', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 119_420n),

    await gasInfo(
      'call commitLock (second time)',
      await collateralManager.connect(accounts.another).commitLock(accounts.other, 12_345n, OTHER_CHAIN_ID, 135_000n),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(131_765n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow cancel lock by protocol with no access granted by whitelist', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      collateralManager.connect(accounts.another).cancelLock(accounts.other, 119_420n, OTHER_CHAIN_ID),
      { customError: 'UnauthorizedLockAccess(.*)' },
    );
  });

  it('Should allow to partially cancel previous lock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 322_000n),

    await gasInfo(
      'call cancelLock (partial amount)',
      await collateralManager.connect(accounts.another).cancelLock(accounts.other, 100_000n, OTHER_CHAIN_ID),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(19_420n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should allow fully cancel previous lock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await collateralManager.connect(accounts.another).commitLock(accounts.other, 119_420n, OTHER_CHAIN_ID, 322_000n),

    await gasInfo(
      'call cancelLock (full amount)',
      await collateralManager.connect(accounts.another).cancelLock(accounts.other, 119_420n, OTHER_CHAIN_ID),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow approve unlock by protocol with no access granted by whitelist', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      collateralManager.connect(accounts.another).approveUnlock(accounts.other, 256_123n, OTHER_CHAIN_ID),
      { customError: 'UnauthorizedUnlockAccess(.*)' },
    );
  });

  it('Should allow to approve first unlock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await gasInfo(
      'call approveUnlock (first time)',
      await collateralManager.connect(accounts.another).approveUnlock(accounts.other, 256_123n, OTHER_CHAIN_ID),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(256_123n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should allow to approve second unlock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await collateralManager.connect(accounts.another).approveUnlock(accounts.other, 256_123n, OTHER_CHAIN_ID),

    await gasInfo(
      'call approveUnlock (second time)',
      await collateralManager.connect(accounts.another).approveUnlock(accounts.other, 880_555n, OTHER_CHAIN_ID),
    );

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(1_136_678n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should not allow reject unlock by protocol with no access granted by whitelist', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 256_123n, OTHER_CHAIN_ID, accounts.another),
      { customError: 'UnauthorizedUnlockAccess(.*)' },
    );
  });

  it('Should allow to reject first unlock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await balanceToken.mint(accounts.other.address, 3_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 3_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 3_456_789n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (first time)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 256_123_000_000_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    const protocolBalance = await balanceToken.balanceOf(accounts.another);
    expect(protocolBalance).to.be.equal(256_123n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(3_200_666_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceToken);
      expect(balanceByToken).to.be.equal(3_200_666_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(3_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should allow to reject second unlock', async function () {
    const { accounts, collateralManager, accessWhitelist, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await accessWhitelist.approveProtocol(accounts.another, true);
    await accessWhitelist.connect(accounts.other).approve(accounts.another, Allowance.ApprovedStrong);

    await balanceToken.mint(accounts.other.address, 3_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 3_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 3_456_789n, OTHER_CHAIN_ID);

    await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 256_123_000_000_000_000n, OTHER_CHAIN_ID, accounts.another);

    await gasInfo(
      'call rejectUnlock (second time)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 1_024_987_000_000_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    const protocolBalance = await balanceToken.balanceOf(accounts.another);
    expect(protocolBalance).to.be.equal(1_281_110n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(2_175_679_000_000_000_000n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(2_175_679_000_000_000_000n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(3_456_789_000_000_000_000n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should report unlocked counter', async function () {
    const { accounts, collateralManager, balanceToken, balanceTokenAddress } = await loadFixture(deployFixture);

    await balanceToken.mint(accounts.other.address, 3_456_789n);
    await balanceToken.connect(accounts.other).approve(collateralManager, 3_456_789n);
    await collateralManager.connect(accounts.other).deposit(balanceTokenAddress, 3_456_789n, OTHER_CHAIN_ID);

    const unlockReport: UnlockReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      unlockChain: TEST_CHAIN_ID,
      lockChain: OTHER_CHAIN_ID,
      account: accounts.other.address,
      unlockCounter: 3_456_789_000_000_000_000n,
    };
    const reportHash = await calcUnlockReportHash(unlockReport);
    const reportEventHash = await calcEventHash(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash);

    const { tx, receipt } = await gasInfo(
      'call reportUnlockCounterUpdate',
      await collateralManager.reportUnlockCounterUpdate(accounts.other, OTHER_CHAIN_ID),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'UnlockReport', check: (data) => {
        expect(data.reportHash).to.be.equal(reportHash);
      },
    });

    const reportEventStored = await collateralManager.hasHashStore(reportEventHash);
    expect(reportEventStored).to.be.equal(true);
  });

  it('Should not update external unlock counter for value not greater than current', async function () {
    const { collateralManager, accounts } = await loadFixture(deployFixture);

    const unlockReport: UnlockReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      unlockChain: OTHER_CHAIN_ID,
      lockChain: TEST_CHAIN_ID,
      account: accounts.other.address,
      unlockCounter: 0n,
    };
    const reportHash = await calcUnlockReportHash(unlockReport);
    const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

    await expectRevert(
      collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 0n, reportProof),
      { customError: 'InvalidUnlockUpdate()' },
    );
  });

  it('Should update external unlock counter for first time', async function () {
    const { accounts, collateralManager, proofVerifier, balanceTokenAddress } = await loadFixture(deployFixture);

    const unlockReport: UnlockReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      unlockChain: OTHER_CHAIN_ID,
      lockChain: TEST_CHAIN_ID,
      account: accounts.other.address,
      unlockCounter: 7_123_456n,
    };
    const reportHash = await calcUnlockReportHash(unlockReport);
    const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

    await gasInfo(
      'call updateUnlockCounter (first time)',
      await collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 7_123_456n, reportProof),
    );

    const verifiedProofCount = await proofVerifier.verifiedProofCount();
    expect(verifiedProofCount).to.be.equal(1n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(7_123_456n);
    }
  });

  it('Should not update external unlock counter for second time if value not greater than current', async function () {
    const { collateralManager, accounts, proofVerifier } = await loadFixture(deployFixture);

    {
      const unlockReport: UnlockReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        unlockChain: OTHER_CHAIN_ID,
        lockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        unlockCounter: 7_123_456n,
      };
      const reportHash = await calcUnlockReportHash(unlockReport);
      const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      await collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 7_123_456n, reportProof);
    }

    {
      const unlockReport: UnlockReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        unlockChain: OTHER_CHAIN_ID,
        lockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        unlockCounter: 7_100_000n,
      };
      const reportHash = await calcUnlockReportHash(unlockReport);
      const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      await expectRevert(
        collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 7_100_000n, reportProof),
        { customError: 'InvalidUnlockUpdate()' },
      );
    }

    const verifiedProofCount = await proofVerifier.verifiedProofCount();
    expect(verifiedProofCount).to.be.equal(1n);
  });

  it('Should update external unlock counter for second time', async function () {
    const { accounts, collateralManager, proofVerifier, balanceTokenAddress } = await loadFixture(deployFixture);

    {
      const unlockReport: UnlockReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        unlockChain: OTHER_CHAIN_ID,
        lockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        unlockCounter: 7_123_456n,
      };
      const reportHash = await calcUnlockReportHash(unlockReport);
      const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      await collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 7_123_456n, reportProof);
    }

    {
      const unlockReport: UnlockReport = {
        variant: STABLECOIN_COLLATERAL_VARIANT,
        unlockChain: OTHER_CHAIN_ID,
        lockChain: TEST_CHAIN_ID,
        account: accounts.other.address,
        unlockCounter: 7_123_457n,
      };
      const reportHash = await calcUnlockReportHash(unlockReport);
      const reportProof = await mockHashEventProof(UNLOCK_REPORT_EVENT_SIGNATURE, reportHash, OTHER_CHAIN_ID);

      await collateralManager.updateUnlockCounter(accounts.other, OTHER_CHAIN_ID, 7_123_457n, reportProof);
    }

    const verifiedProofCount = await proofVerifier.verifiedProofCount();
    expect(verifiedProofCount).to.be.equal(2n);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(0n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(0n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(7_123_457n);
    }
  });

  it('Should report withdraw for first time', async function () {
    const { accounts, collateralManager, balanceTokenAddress } = await loadFixture(deployFixture);

    const withdrawReport: WithdrawReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      lockChain: TEST_CHAIN_ID,
      unlockChain: OTHER_CHAIN_ID,
      account: accounts.other.address,
      lockCounter: 500_000n,
      amount: 500_000n,
      nonce: 0n,
    };
    const reportHash = await calcWithdrawReportHash(withdrawReport);
    const reportEventHash = await calcEventHash(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash);

    const { tx, receipt } = await gasInfo(
      'call reportWithdraw (first time)',
      await collateralManager.connect(accounts.other).reportWithdraw(500_000n, OTHER_CHAIN_ID),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'WithdrawReport', check: (data) => {
        expect(data.reportHash).to.be.equal(reportHash);
      },
    });

    const reportEventStored = await collateralManager.hasHashStore(reportEventHash);
    expect(reportEventStored).to.be.equal(true);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(500_000n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(1n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });

  it('Should report withdraw for second time', async function () {
    const { accounts, collateralManager, balanceTokenAddress } = await loadFixture(deployFixture);

    await collateralManager.connect(accounts.other).reportWithdraw(500_000n, OTHER_CHAIN_ID);

    const withdrawReport: WithdrawReport = {
      variant: STABLECOIN_COLLATERAL_VARIANT,
      lockChain: TEST_CHAIN_ID,
      unlockChain: OTHER_CHAIN_ID,
      account: accounts.other.address,
      lockCounter: 700_000n,
      amount: 200_000n,
      nonce: 1n,
    };
    const reportHash = await calcWithdrawReportHash(withdrawReport);
    const reportEventHash = await calcEventHash(WITHDRAW_REPORT_EVENT_SIGNATURE, reportHash);

    const { tx, receipt } = await gasInfo(
      'call reportWithdraw (second time)',
      await collateralManager.connect(accounts.other).reportWithdraw(200_000n, OTHER_CHAIN_ID),
    );

    expectLog({
      contract: collateralManager, tx, receipt, name: 'WithdrawReport', check: (data) => {
        expect(data.reportHash).to.be.equal(reportHash);
      },
    });

    const reportEventStored = await collateralManager.hasHashStore(reportEventHash);
    expect(reportEventStored).to.be.equal(true);

    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const balanceByToken = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, balanceTokenAddress);
      expect(balanceByToken).to.be.equal(0n);

      const unlockCounter = await collateralManager.unlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(unlockCounter).to.be.equal(0n);

      const unlockWithdrawNonce = await collateralManager.unlockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(unlockWithdrawNonce).to.be.equal(0n);

      const lockCounter = await collateralManager.lockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(lockCounter).to.be.equal(700_000n);

      const lockWithdrawNonce = await collateralManager.lockWithdrawNonce(accounts.other, OTHER_CHAIN_ID);
      expect(lockWithdrawNonce).to.be.equal(2n);

      const externalUnlockCounter = await collateralManager.externalUnlockCounter(accounts.other, OTHER_CHAIN_ID);
      expect(externalUnlockCounter).to.be.equal(0n);
    }
  });
});
