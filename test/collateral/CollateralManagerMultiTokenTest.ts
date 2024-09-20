import { ethers } from 'hardhat';
import { getCreateAddress } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { encodeBalanceTokens } from '../../scripts/lib/contract/collateral/balanceTokenEncode';
import { STABLECOIN_COLLATERAL_VARIANT } from '../../scripts/lib/contract/collateral/variant';

import { Allowance } from '../../scripts/lib/contract/whitelist/approve-access/allowance';

import { gasInfo } from '../common/gas';
import { OTHER_CHAIN_ID } from '../common/chainId';

describe('CollateralManagerMultiTokenTest', function () {
  async function deployFixture() {
    const [ownerAccount, otherAccount, anotherAccount] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory('TestToken');
    const testToken0 = await TestToken.deploy();
    const testToken8 = await TestToken.deploy();
    const testToken18 = await TestToken.deploy();

    const testToken0Address = await testToken0.getAddress();
    const testToken8Address = await testToken8.getAddress();
    const testToken18Address = await testToken18.getAddress();

    const balanceDecimals = 18;
    const balanceTokenData = await encodeBalanceTokens([
      {
        address: testToken0Address,
        decimals: 0,
      },
      {
        address: testToken8Address,
        decimals: 8,
      },
      {
        address: testToken18Address,
        decimals: 18,
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

    await accessWhitelist.approveProtocol(anotherAccount, true);
    await accessWhitelist.connect(otherAccount).approve(anotherAccount, Allowance.ApprovedStrong);

    return {
      accounts: {
        owner: ownerAccount,
        other: otherAccount,
        another: anotherAccount,
      },
      tokens: {
        d0: testToken0,
        d8: testToken8,
        d18: testToken18,
      },
      tokenAddresses: {
        d0: await testToken0.getAddress(),
        d8: await testToken8.getAddress(),
        d18: await testToken18.getAddress(),
      },
      proofVerifier,
      accessWhitelist,
      collateralManager,
    };
  }

  it('Should provide relevant aggregated token views after deploy', async function () {
    const { collateralManager, tokenAddresses, accounts } = await loadFixture(deployFixture);

    const decimals = await collateralManager.DECIMALS();
    expect(decimals).to.be.equal(18n);

    const totalTokens = await collateralManager.TOTAL_BALANCE_TOKENS();
    expect(totalTokens).to.be.equal(3n);

    // Non-token
    const isToken = await collateralManager.isBalanceToken(accounts.another);
    expect(isToken).to.be.equal(false);

    // Token #0 (0 decimals)
    {
      const isToken = await collateralManager.isBalanceToken(tokenAddresses.d0);
      expect(isToken).to.be.equal(true);
  
      const tokenIndex = await collateralManager.balanceTokenIndex(tokenAddresses.d0);
      expect(tokenIndex).to.be.equal(0n);
  
      const tokenDecimals = await collateralManager.balanceTokenDecimals(tokenAddresses.d0);
      expect(tokenDecimals).to.be.equal(0n);
  
      const tokenAddress = await collateralManager.balanceTokenByIndex(0n);
      expect(tokenAddress).to.be.equal(tokenAddresses.d0);
    }

    // Token #1 (8 decimals)
    {
      const isToken = await collateralManager.isBalanceToken(tokenAddresses.d8);
      expect(isToken).to.be.equal(true);
  
      const tokenIndex = await collateralManager.balanceTokenIndex(tokenAddresses.d8);
      expect(tokenIndex).to.be.equal(1n);
  
      const tokenDecimals = await collateralManager.balanceTokenDecimals(tokenAddresses.d8);
      expect(tokenDecimals).to.be.equal(8n);
  
      const tokenAddress = await collateralManager.balanceTokenByIndex(1n);
      expect(tokenAddress).to.be.equal(tokenAddresses.d8);
    }

    // Token #2 (18 decimals)
    {
      const isToken = await collateralManager.isBalanceToken(tokenAddresses.d18);
      expect(isToken).to.be.equal(true);
  
      const tokenIndex = await collateralManager.balanceTokenIndex(tokenAddresses.d18);
      expect(tokenIndex).to.be.equal(2n);
  
      const tokenDecimals = await collateralManager.balanceTokenDecimals(tokenAddresses.d18);
      expect(tokenDecimals).to.be.equal(18n);
  
      const tokenAddress = await collateralManager.balanceTokenByIndex(2n);
      expect(tokenAddress).to.be.equal(tokenAddresses.d18);
    }
  });

  it('Should setup info about balances per token after deposits', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    // Balance records of Other in Collateral Manager (before)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(13_371_337_554_164_374_217_881_337_420_451n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(13_371_337_420_451_000_000_000_000_000_000n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(133_713_374_204_510_000_000_000n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Balance records of Another in Collateral Manager (before)
    {
      const balance = await collateralManager.balance(accounts.another, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const d0Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(0n);
    }

    // Token balance of Collateral Manager (before)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Another (before)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(0n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for one token partial cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, one token, partial cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_420_000_000_000_000_000_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(134_164_374_217_881_337_420_451n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(451_000_000_000_000_000_000n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(133_713_374_204_510_000_000_000n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Balance records of Another in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.another, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const d0Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(0n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(451n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_000n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(0n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for one token full cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, one token, full cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_420_451_000_000_000_000_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(133_713_374_217_881_337_420_451n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(133_713_374_204_510_000_000_000n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Balance records of Another in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.another, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const d0Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.another, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(0n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(0n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for two tokens partial cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, two tokens, partial cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_520_736_030_653_382_500_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(33_428_343_564_498_837_420_451n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(33_428_343_551_127_500_000_000n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(3_342_834_355_113n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(10_028_503_065_338n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(0n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for two tokens full cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, two tokens, full cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_554_164_374_204_510_000_000_000n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(13_371_337_420_451n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(0n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for three tokens partial cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, three tokens, partial cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_554_164_374_213_424_224_946_967n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(4_457_112_473_484n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(4_457_112_473_484n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(4_457_112_473_484n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(8_914_224_946_967n);
    }
  });

  it('Should update balance info about balance tokens during unlock reject for three tokens full cover', async function () {
    const { collateralManager, accounts, tokens, tokenAddresses } = await loadFixture(deployFixture);

    await tokens.d0.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d0.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d0, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d8.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d8.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d8, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await tokens.d18.mint(accounts.other, 13_371_337_420_451n);
    await tokens.d18.connect(accounts.other).approve(collateralManager, 13_371_337_420_451n);
    await collateralManager.connect(accounts.other).deposit(tokens.d18, 13_371_337_420_451n, OTHER_CHAIN_ID);

    await gasInfo(
      'call rejectUnlock (to new account, partial amount, three tokens, full cover)',
      await collateralManager.connect(accounts.another).rejectUnlock(accounts.other, 13_371_337_554_164_374_217_881_337_420_451n, OTHER_CHAIN_ID, accounts.another),
    );

    // Balance records of Other in Collateral Manager (after)
    {
      const balance = await collateralManager.balance(accounts.other, OTHER_CHAIN_ID);
      expect(balance).to.be.equal(0n);

      const d0Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d0);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d8);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await collateralManager.balanceByToken(accounts.other, OTHER_CHAIN_ID, tokenAddresses.d18);
      expect(d18Balance).to.be.equal(0n);
    }

    // Token balance of Collateral Manager (after)
    {
      const d0Balance = await tokens.d0.balanceOf(collateralManager);
      expect(d0Balance).to.be.equal(0n);

      const d8Balance = await tokens.d8.balanceOf(collateralManager);
      expect(d8Balance).to.be.equal(0n);

      const d18Balance = await tokens.d18.balanceOf(collateralManager);
      expect(d18Balance).to.be.equal(0n);
    }

    // Token balance of Another (after)
    {
      const d0Balance = await tokens.d0.balanceOf(accounts.another);
      expect(d0Balance).to.be.equal(13_371_337_420_451n);

      const d8Balance = await tokens.d8.balanceOf(accounts.another);
      expect(d8Balance).to.be.equal(13_371_337_420_451n);

      const d18Balance = await tokens.d18.balanceOf(accounts.another);
      expect(d18Balance).to.be.equal(13_371_337_420_451n);
    }
  });
});
