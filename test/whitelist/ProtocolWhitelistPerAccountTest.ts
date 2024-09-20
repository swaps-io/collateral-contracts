import { ethers } from 'hardhat';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';

import { Allowance } from '../../scripts/lib/contract/whitelist/approve-access/allowance';

import { expectRevert } from '../common/revert';
import { gasInfo } from '../common/gas';
import { expectLog } from '../common/log';

const TEST_PROTOCOL = '0xDeadc0dedeAdc0DEDeaDc0deDeADc0DedEadc0De';
const OTHER_PROTOCOL = '0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef';

describe('ProtocolWhitelistPerAccountTest', function () {
  async function deployFixture() {
    const [ownerAccount, otherAccount, anotherAccount] = await ethers.getSigners();

    const ApproveAccessWhitelistOwned = await ethers.getContractFactory('ApproveAccessWhitelistOwned');
    const whitelist = await ApproveAccessWhitelistOwned.deploy(ownerAccount);

    return {
      accounts: {
        owner: ownerAccount,
        other: otherAccount,
        another: anotherAccount,
      },
      whitelist,
    };
  }

  it('Should have revoked allowance for protocol after whitelist deploy', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    const protocolAllowance = await whitelist.protocolAllowance(TEST_PROTOCOL);
    expect(protocolAllowance).to.be.equal(false);
  });

  it('Should have revoked allowance for account protocol after whitelist deploy', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    const allowance = await whitelist.allowance(accounts.another, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.Revoked);
  });

  it('Should non approve account protocol after whitelist deploy', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    const approved = await whitelist.isApproved(accounts.another, TEST_PROTOCOL);
    expect(approved).to.be.equal(false);
  });

  it('Should non allow to approve protocol for whitelist non-owner', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      whitelist.connect(accounts.other).approveProtocol(TEST_PROTOCOL, true),
      { customError: 'OwnableUnauthorizedAccount(.*)' },
    );
  });

  it('Should allow approve protocol for whitelist owner', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    const { tx, receipt } = await gasInfo(
      'call approveProtocol (false -> true, first time)',
      await whitelist.approveProtocol(TEST_PROTOCOL, true),
    );

    expectLog({
      contract: whitelist, tx, receipt, name: 'ProtocolApproval', check: (data) => {
        expect(data.protocol).to.be.equal(TEST_PROTOCOL);
        expect(data.allowance).to.be.equal(true);
      },
    });

    const protocolAllowance = await whitelist.protocolAllowance(TEST_PROTOCOL);
    expect(protocolAllowance).to.be.equal(true);
  });

  it('Should not affect other protocol allowance by approving current', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);

    const otherAllowance = await whitelist.protocolAllowance(OTHER_PROTOCOL);
    expect(otherAllowance).to.be.equal(false);
  });

  it('Should not allow approve already approved protocol', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);

    await expectRevert(
      whitelist.approveProtocol(TEST_PROTOCOL, true),
      { customError: 'SameProtocolAllowance()' },
    );
  });

  it('Should non allow to revoke protocol for whitelist non-owner', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);

    await expectRevert(
      whitelist.connect(accounts.other).approveProtocol(TEST_PROTOCOL, false),
      { customError: 'OwnableUnauthorizedAccount(.*)' },
    );
  });

  it('Should allow revoke protocol for whitelist owner', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
  
    const { tx, receipt } = await gasInfo(
      'call approveProtocol (true -> false, second time)',
      await whitelist.approveProtocol(TEST_PROTOCOL, false),
    );

    expectLog({
      contract: whitelist, tx, receipt, name: 'ProtocolApproval', check: (data) => {
        expect(data.protocol).to.be.equal(TEST_PROTOCOL);
        expect(data.allowance).to.be.equal(false);
      },
    });

    const protocolAllowance = await whitelist.protocolAllowance(TEST_PROTOCOL);
    expect(protocolAllowance).to.be.equal(false);
  });

  it('Should not affect other protocol allowance by revoking current', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.approveProtocol(OTHER_PROTOCOL, true);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    const otherAllowance = await whitelist.protocolAllowance(OTHER_PROTOCOL);
    expect(otherAllowance).to.be.equal(true);
  });

  it('Should not allow revoke already revoked protocol', async function () {
    const { whitelist } = await loadFixture(deployFixture);

    await expectRevert(
      whitelist.approveProtocol(TEST_PROTOCOL, false),
      { customError: 'SameProtocolAllowance()' },
    );
  });

  it('Should not allow strong approve by account of owner-revoked protocol', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong),
      { customError: 'ProtocolNotApproved()' },
    );
  });

  it('Should not allow weak approve by account of owner-revoked protocol', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak),
      { customError: 'ProtocolNotApproved()' },
    );
  });

  it('Should allow strong approve by account of owner-approved protocol', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);

    const { tx, receipt } = await gasInfo(
      'call approve (revoked -> approved strong, first time)',
      await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong),
    );

    expectLog({
      contract: whitelist, tx, receipt, name: 'Approval', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.protocol).to.be.equal(TEST_PROTOCOL);
        expect(data.allowance).to.be.equal(Allowance.ApprovedStrong);
      },
    });

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedStrong);
  });

  it('Should allow weak approve by account of owner-approved protocol', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);

    const { tx, receipt } = await gasInfo(
      'call approve (revoked -> approved weak, first time)',
      await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak),
    );

    expectLog({
      contract: whitelist, tx, receipt, name: 'Approval', check: (data) => {
        expect(data.account).to.be.equal(accounts.other.address);
        expect(data.protocol).to.be.equal(TEST_PROTOCOL);
        expect(data.allowance).to.be.equal(Allowance.ApprovedWeak);
      },
    });

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedWeak);
  });

  it('Should now change other protocol allowance by approving current', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    const otherAllowance = await whitelist.allowance(accounts.other, OTHER_PROTOCOL);
    expect(otherAllowance).to.be.equal(Allowance.Revoked);
  });

  it('Should now change other account allowance by approving current', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    const otherAllowance = await whitelist.allowance(accounts.another, TEST_PROTOCOL);
    expect(otherAllowance).to.be.equal(Allowance.Revoked);
  });

  it('Should consider protocol whitelist-approved when approved by owner and account as weak', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    const approved = await whitelist.isApproved(accounts.other, TEST_PROTOCOL);
    expect(approved).to.be.equal(true);
  });

  it('Should consider protocol whitelist-approved when approved by owner and account as strong', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    const approved = await whitelist.isApproved(accounts.other, TEST_PROTOCOL);
    expect(approved).to.be.equal(true);
  });

  it('Should allow account switch approve from strong to weak when protocol is allowed', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    await gasInfo(
      'call approve (approved strong -> approved weak, second time)',
      await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak),
    );

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedWeak);
  });

  it('Should allow account switch approve from weak to strong when protocol is allowed', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedStrong);
  });

  it('Should allow account switch approve from strong to weak when protocol is revoked', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedWeak);
  });

  it('Should allow account switch approve from weak to strong when protocol is revoked', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    const allowance = await whitelist.allowance(accounts.other, TEST_PROTOCOL);
    expect(allowance).to.be.equal(Allowance.ApprovedStrong);
  });

  it('Should not allow account switch from weak approve to revoked when protocol is allowed', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.Revoked),
      { customError: 'RevokeNotAllowed()' },
    );
  });

  it('Should not allow account switch from strong approve to revoked when protocol is allowed', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.Revoked),
      { customError: 'RevokeNotAllowed()' },
    );
  });

  it('Should not allow account switch from weak approve to revoked when protocol is revoked', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.Revoked),
      { customError: 'RevokeNotAllowed()' },
    );
  });

  it('Should not allow account switch from strong approve to revoked when protocol is revoked', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    await expectRevert(
      whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.Revoked),
      { customError: 'RevokeNotAllowed()' },
    );
  });

  it('Should not considered protocol whitelist-approved when protocol is revoked and weak approve is in use', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);

    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    const approved = await whitelist.isApproved(accounts.other, TEST_PROTOCOL);
    expect(approved).to.be.equal(false);
  });

  it('Should considered protocol whitelist-approved when protocol is revoked and strong approve is in use', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    const approved = await whitelist.isApproved(accounts.other, TEST_PROTOCOL);
    expect(approved).to.be.equal(true);
  });

  it('Should not considered protocol whitelist-approved when protocol is revoked and approve changed to strong afterwards', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.approveProtocol(TEST_PROTOCOL, true);
    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedWeak);
    await whitelist.approveProtocol(TEST_PROTOCOL, false);

    await whitelist.connect(accounts.other).approve(TEST_PROTOCOL, Allowance.ApprovedStrong);

    const approved = await whitelist.isApproved(accounts.other, TEST_PROTOCOL);
    expect(approved).to.be.equal(true);
  });

  it('Should not allow whitelist ownership transfer to new account by non-owner', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await expectRevert(
      whitelist.connect(accounts.other).transferOwnership(accounts.another),
      { customError: 'OwnableUnauthorizedAccount(.*)' },
    );
  });

  it('Should allow whitelist ownership transfer to new account by owner', async function () {
    const { whitelist, accounts } = await loadFixture(deployFixture);

    await whitelist.transferOwnership(accounts.another);
    await whitelist.connect(accounts.another).acceptOwnership();

    const owner = await whitelist.owner();
    expect(owner).to.be.equal(accounts.another.address);
  });
});
