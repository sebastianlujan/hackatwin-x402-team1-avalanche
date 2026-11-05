// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';
import { Vm } from 'forge-std/Vm.sol';

import { IcttMessenger } from 'src/IcttMessenger.sol';
import { IIcttMessenger } from 'src/interfaces/IIcttMessenger.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { SendAndCallInput } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { TestTokenTransferrer } from 'test/utils/TestTokenTransferrer.sol';

contract UnitIcttMessengerSend is Test {
  bytes32 internal constant _DESTINATION = keccak256('l1');
  uint256 internal constant _REQUIRED_GAS = 500_000;
  uint256 internal constant _RECIPIENT_GAS = 250_000;
  Id internal constant _LANE = Id.wrap(keccak256('lane'));
  bytes32 internal constant _PAYMENT = keccak256('payment');

  address internal _hub = makeAddr('hub');
  address internal _destinationTransferrer = makeAddr('destinationTransferrer');
  address internal _receiver = makeAddr('receiver');
  address internal _fallback = makeAddr('fallback');
  address internal _merchant = makeAddr('merchant');

  MockERC20 internal _token;
  TestTokenTransferrer internal _transferrer;
  IcttMessenger internal _messenger;

  function setUp() external {
    _token = new MockERC20();
    _transferrer = new TestTokenTransferrer(_token);
    _messenger = new IcttMessenger(
      _hub,
      _transferrer,
      address(_token),
      _DESTINATION,
      _destinationTransferrer,
      _receiver,
      _REQUIRED_GAS,
      _RECIPIENT_GAS,
      _fallback
    );
    _token.mint(_hub, 1000);
    vm.prank(_hub);
    _token.approve(address(_messenger), type(uint256).max);
  }

  modifier whenTheHubSendsAPayment() {
    _;
  }

  function test_GivenACallerThatIsNotTheHub() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_OnlyHub
    address _other = makeAddr('other');
    vm.expectRevert(abi.encodeWithSelector(IIcttMessenger.IcttMessenger_OnlyHub.selector, _other));
    vm.prank(_other);
    _messenger.send(_LANE, _PAYMENT, _lane(address(_token), _DESTINATION), 100);
  }

  function test_GivenALaneDestinationThatIsNotConfigured() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_DestinationMismatch
    bytes32 _foreign = keccak256('foreign');
    vm.expectRevert(abi.encodeWithSelector(IIcttMessenger.IcttMessenger_DestinationMismatch.selector, _foreign));
    vm.prank(_hub);
    _messenger.send(_LANE, _PAYMENT, _lane(address(_token), _foreign), 100);
  }

  function test_GivenALaneTokenThatIsNotTheBoundToken() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_TokenMismatch
    address _foreign = makeAddr('foreignToken');
    vm.expectRevert(abi.encodeWithSelector(IIcttMessenger.IcttMessenger_TokenMismatch.selector, _foreign));
    vm.prank(_hub);
    _messenger.send(_LANE, _PAYMENT, _lane(_foreign, _DESTINATION), 100);
  }

  function test_GivenAZeroAmount() external whenTheHubSendsAPayment {
    // it reverts with IcttMessenger_ZeroAmount
    vm.expectRevert(IIcttMessenger.IcttMessenger_ZeroAmount.selector);
    vm.prank(_hub);
    _messenger.send(_LANE, _PAYMENT, _lane(address(_token), _DESTINATION), 0);
  }

  function test_GivenAValidPayment() external whenTheHubSendsAPayment {
    // it passes the configured values and the payment to sendAndCall
    // it approves exactly the amount and leaves no balance or allowance
    // it emits one PaymentSent
    vm.recordLogs();
    vm.prank(_hub);
    _messenger.send(_LANE, _PAYMENT, _lane(address(_token), _DESTINATION), 100);

    SendAndCallInput memory _expected = SendAndCallInput({
      destinationBlockchainID: _DESTINATION,
      destinationTokenTransferrerAddress: _destinationTransferrer,
      recipientContract: _receiver,
      recipientPayload: abi.encode(_PAYMENT, _merchant),
      requiredGasLimit: _REQUIRED_GAS,
      recipientGasLimit: _RECIPIENT_GAS,
      multiHopFallback: address(0),
      fallbackRecipient: _fallback,
      primaryFeeTokenAddress: address(0),
      primaryFee: 0,
      secondaryFee: 0
    });
    assertEq(abi.encode(_transferrer.recorded()), abi.encode(_expected));
    assertEq(_token.balanceOf(address(_transferrer)), 100);
    assertEq(_token.balanceOf(address(_messenger)), 0);
    assertEq(_token.allowance(address(_messenger), address(_transferrer)), 0);
    assertEq(_token.balanceOf(_fallback), 0);

    Vm.Log[] memory _logs = vm.getRecordedLogs();
    uint256 _sent;
    for (uint256 _i; _i < _logs.length; ++_i) {
      if (_logs[_i].emitter == address(_messenger) && _logs[_i].topics[0] == IIcttMessenger.PaymentSent.selector) {
        ++_sent;
        assertEq(_logs[_i].topics[1], Id.unwrap(_LANE));
        assertEq(_logs[_i].topics[2], _PAYMENT);
        assertEq(_logs[_i].data, abi.encode(_merchant, 100));
      }
    }
    assertEq(_sent, 1);
  }

  function test_GivenATransferrerThatReverts() external whenTheHubSendsAPayment {
    // it reverts and leaves no tokens in the messenger
    _transferrer.setMode(TestTokenTransferrer.Mode.Revert);
    vm.expectRevert('transferrer failed');
    vm.prank(_hub);
    _messenger.send(_LANE, _PAYMENT, _lane(address(_token), _DESTINATION), 100);

    assertEq(_token.balanceOf(address(_messenger)), 0);
    assertEq(_token.balanceOf(_hub), 1000);
  }

  function _lane(address _t, bytes32 _d) internal view returns (IPaymentHub.LaneParams memory _p) {
    _p = IPaymentHub.LaneParams({ token: _t, merchant: _merchant, messenger: address(_messenger), destination: _d });
  }
}
