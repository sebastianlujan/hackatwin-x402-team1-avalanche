// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';
import { CallbackMerchant } from 'test/utils/CallbackMerchant.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

contract GasSettlementReceiver is Test {
  // The documented recipientGasLimit the settled path with a callback must fit
  uint256 internal constant _RECIPIENT_GAS_LIMIT = 300_000;
  bytes32 internal constant _SOURCE = keccak256('fuji');

  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _plain = makeAddr('plain');
  address internal _stranger = makeAddr('stranger');

  MockERC20 internal _token;
  address internal _transferrer;
  SettlementReceiver internal _receiver;
  CallbackMerchant internal _callback;

  function setUp() external {
    _token = new MockERC20();
    _transferrer = address(new TestTokenTransferrer(_token));
    _receiver =
      new SettlementReceiver(_transferrer, _SOURCE, _originTransferrer, _originSender, address(_token), address(this));
    _callback = new CallbackMerchant();
    _callback.configure(CallbackMerchant.Mode.Ok, IPaymentHub(address(0)), Id.wrap(0));
    _receiver.setMerchant(_plain, true);
    _receiver.setMerchant(address(_callback), true);
    _token.mint(_transferrer, 1000);
    vm.prank(_transferrer);
    _token.approve(address(_receiver), type(uint256).max);
  }

  modifier whenTheReceiverHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenASettledDeliveryToAMerchantWithoutCode() external whenTheReceiverHotPathsRunOnFreshState {
    // it settles and the gas lands in the snapshot
    _deliver(keccak256('plain'), _plain, 10);
    assertEq(uint8(_receiver.statusOf(keccak256('plain'))), uint8(ISettlementReceiver.Status.Settled));
  }

  function test_GivenASettledDeliveryToAMerchantWithASucceedingCallback()
    external
    whenTheReceiverHotPathsRunOnFreshState
  {
    // it settles and the gas lands in the snapshot
    // it fits the documented recipient gas limit
    uint256 _before = gasleft();
    _deliver(keccak256('callback'), address(_callback), 10);
    uint256 _used = _before - gasleft();

    assertEq(uint8(_receiver.statusOf(keccak256('callback'))), uint8(ISettlementReceiver.Status.Settled));
    assertEq(_callback.lastAmount(), 10);
    assertLt(_used, _RECIPIENT_GAS_LIMIT);
  }

  function test_GivenARejectedDelivery() external whenTheReceiverHotPathsRunOnFreshState {
    // it rejects and the gas lands in the snapshot
    _deliver(keccak256('rejected'), _stranger, 10);
    assertEq(uint8(_receiver.statusOf(keccak256('rejected'))), uint8(ISettlementReceiver.Status.Rejected));
  }

  function test_GivenACreditedMerchant() external whenTheReceiverHotPathsRunOnFreshState {
    // it withdraws and the gas lands in the snapshot
    _deliver(keccak256('plain'), _plain, 10);
    vm.prank(_plain);
    _receiver.withdraw();
    assertEq(_token.balanceOf(_plain), 10);
  }

  function _deliver(bytes32 _paymentId, address _to, uint256 _amount) internal {
    vm.prank(_transferrer);
    _receiver.receiveTokens{ gas: _RECIPIENT_GAS_LIMIT }(
      _SOURCE, _originTransferrer, _originSender, address(_token), _amount, abi.encode(_paymentId, _to)
    );
  }
}
