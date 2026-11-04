// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { Test } from 'forge-std/Test.sol';

import { PaymentBroker } from 'src/PaymentBroker.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { MockERC20 } from 'test/utils/MockERC20.sol';
import { MockMessenger } from 'test/utils/MockMessenger.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

/// @notice Deploys the broker on a fake router address with a funded hub and builds CCIP messages for it
abstract contract BrokerFixture is Test {
  uint64 internal constant _SELECTOR_A = 1;
  uint64 internal constant _SELECTOR_B = 2;
  uint256 internal constant _BALANCE = 1000;
  uint256 internal constant _BUDGET = 500;

  address internal _router = makeAddr('router');
  address internal _senderX = makeAddr('senderX');
  address internal _senderY = makeAddr('senderY');
  address internal _payerP = makeAddr('payerP');
  address internal _payerQ = makeAddr('payerQ');

  PaymentHubHarness internal _hub;
  PaymentBroker internal _broker;
  MockERC20 internal _token;
  MockMessenger internal _messenger;
  Id internal _lane;
  uint256 internal _deadline;

  function _deployBroker() internal {
    vm.warp(1_000_000);
    _deadline = block.timestamp + 1 hours;
    _hub = new PaymentHubHarness(address(this));
    _token = new MockERC20();
    _messenger = new MockMessenger();
    _hub.enableMessenger(address(_messenger));
    _lane = _hub.createLane(IPaymentHub.LaneParams(address(_token), makeAddr('merchant'), address(_messenger), 'dest'));
    _broker = new PaymentBroker(_router, address(_hub), address(this));
    _fund(_payerP);
    _fund(_payerQ);
  }

  function _fund(address _payer) internal {
    _token.mint(_payer, _BALANCE);
    vm.prank(_payer);
    _token.approve(address(_hub), type(uint256).max);
    _hub.exposed_setBudget(_payer, address(_broker), address(_token), _BUDGET);
  }

  function _paymentId(uint256 _count) internal view returns (bytes32 _id) {
    _id = keccak256(abi.encode(block.chainid, address(_hub), _count));
  }

  function _valid(address _onBehalf) internal view returns (bytes memory _payload) {
    _payload = _data(_lane, _onBehalf, 100, _deadline);
  }

  function _data(
    Id _laneId,
    address _onBehalf,
    uint256 _amount,
    uint256 _until
  )
    internal
    pure
    returns (bytes memory _payload)
  {
    _payload = abi.encode(_laneId, _onBehalf, _amount, _until);
  }

  function _message(
    bytes32 _messageId,
    uint64 _selector,
    address _sender,
    bytes memory _payload
  )
    internal
    pure
    returns (Client.Any2EVMMessage memory _built)
  {
    _built = Client.Any2EVMMessage(_messageId, _selector, abi.encode(_sender), _payload, new Client.EVMTokenAmount[](0));
  }

  function _deliver(Client.Any2EVMMessage memory _delivered) internal {
    vm.prank(_router);
    _broker.ccipReceive(_delivered);
  }
}
