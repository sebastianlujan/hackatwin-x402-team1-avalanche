// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { IERC20Errors } from '@openzeppelin/contracts/interfaces/draft-IERC6093.sol';
import { Test } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

contract UnitSettlementReceiverOutcome is Test {
  bytes32 internal constant _SOURCE = keccak256('fuji');
  bytes32 internal constant _PAYMENT = keccak256('payment');

  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _fallback = makeAddr('fallback');
  address internal _merchant = makeAddr('merchant');

  MockERC20 internal _token;
  TestTokenTransferrer internal _transferrer;
  SettlementReceiver internal _receiver;

  function setUp() external {
    _token = new MockERC20();
    _transferrer = new TestTokenTransferrer(_token);
    _fund(1000);
    _receiver = new SettlementReceiver(
      address(_transferrer), _SOURCE, _originTransferrer, _originSender, address(_token), address(this)
    );
  }

  modifier whenTheOwnerManagesTheAllowlist() {
    _;
  }

  function test_GivenTheOwnerAllowlistsAMerchant() external whenTheOwnerManagesTheAllowlist {
    // it emits MerchantSet and the next payment for it settles
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.MerchantSet(_merchant, true);
    _receiver.setMerchant(_merchant, true);

    _deliver(_PAYMENT, _merchant, 100);
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Settled));
  }

  function test_GivenTheOwnerRemovesAMerchant() external whenTheOwnerManagesTheAllowlist {
    // it emits MerchantSet and the next payment for it is rejected
    _receiver.setMerchant(_merchant, true);
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.MerchantSet(_merchant, false);
    _receiver.setMerchant(_merchant, false);

    _deliver(_PAYMENT, _merchant, 100);
    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Rejected));
  }

  function test_GivenAZeroMerchant() external whenTheOwnerManagesTheAllowlist {
    // it reverts with SettlementReceiver_ZeroAddress
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAddress.selector);
    _receiver.setMerchant(address(0), true);
  }

  function test_GivenACallerThatIsNotTheOwner() external whenTheOwnerManagesTheAllowlist {
    // it reverts with OwnableUnauthorizedAccount
    address _other = makeAddr('other');
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _other));
    vm.prank(_other);
    _receiver.setMerchant(_merchant, true);
  }

  modifier whenAValidatedDeliveryArrives() {
    _;
  }

  function test_GivenAnAllowlistedMerchant() external whenAValidatedDeliveryArrives {
    // it pulls the amount and credits the merchant and emits Received then Settled
    _receiver.setMerchant(_merchant, true);
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.StatusChanged(
      _PAYMENT, ISettlementReceiver.Status.None, ISettlementReceiver.Status.Received
    );
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.StatusChanged(
      _PAYMENT, ISettlementReceiver.Status.Received, ISettlementReceiver.Status.Settled
    );
    _deliver(_PAYMENT, _merchant, 100);

    assertEq(_token.balanceOf(address(_receiver)), 100);
    assertEq(_receiver.creditOf(_merchant), 100);
    assertEq(_token.balanceOf(_fallback), 0);
    assertEq(_token.balanceOf(address(_transferrer)), 900);
  }

  function test_GivenATokenPullThatReverts() external whenAValidatedDeliveryArrives {
    // it reverts and stores no status
    _receiver.setMerchant(_merchant, true);
    vm.expectPartialRevert(IERC20Errors.ERC20InsufficientAllowance.selector);
    vm.prank(address(_transferrer));
    _receiver.receiveTokens(
      _SOURCE, _originTransferrer, _originSender, address(_token), 100, abi.encode(_PAYMENT, _merchant)
    );

    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.None));
    assertEq(_receiver.creditOf(_merchant), 0);
  }

  function test_GivenAMerchantThatIsNotAllowlisted() external whenAValidatedDeliveryArrives {
    // it records Rejected and pulls nothing without reverting
    vm.expectEmit(true, false, false, true, address(_receiver));
    emit ISettlementReceiver.StatusChanged(
      _PAYMENT, ISettlementReceiver.Status.Received, ISettlementReceiver.Status.Rejected
    );
    assertTrue(_deliver(_PAYMENT, _merchant, 100));

    assertEq(uint8(_receiver.statusOf(_PAYMENT)), uint8(ISettlementReceiver.Status.Rejected));
    assertEq(_token.balanceOf(address(_receiver)), 0);
    assertEq(_receiver.creditOf(_merchant), 0);
  }

  function test_GivenARejectedPaymentDeliveredThroughTheTransferrer() external whenAValidatedDeliveryArrives {
    // it leaves the full amount with the fallback recipient and none in the receiver
    _deliver(_PAYMENT, _merchant, 100);
    _deliver(keccak256('second'), _merchant, 7);

    assertEq(_token.balanceOf(_fallback), 107);
    assertEq(_token.balanceOf(address(_receiver)), 0);
    assertEq(_token.balanceOf(address(_transferrer)), 1000 - 107);
  }

  function _fund(uint256 _amount) internal {
    _token.mint(address(_transferrer), _amount);
  }

  function _deliver(bytes32 _paymentId, address _to, uint256 _amount) internal returns (bool _ok) {
    _ok = _transferrer.deliver(
      _receiver, _SOURCE, _originTransferrer, _originSender, _amount, abi.encode(_paymentId, _to), _fallback
    );
  }
}
