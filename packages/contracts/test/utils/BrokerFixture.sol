// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { Test } from 'forge-std/Test.sol';

import { PaymentBroker } from 'src/PaymentBroker.sol';
import { PaymentHub } from 'src/PaymentHub.sol';
import { Id } from 'src/interfaces/IPaymentHub.sol';

/// @notice Deploys the broker on a fake router address and builds CCIP messages for it
abstract contract BrokerFixture is Test {
  uint64 internal constant _SELECTOR_A = 1;
  uint64 internal constant _SELECTOR_B = 2;

  address internal _router = makeAddr('router');
  address internal _senderX = makeAddr('senderX');
  address internal _senderY = makeAddr('senderY');
  address internal _payerP = makeAddr('payerP');
  address internal _payerQ = makeAddr('payerQ');

  PaymentHub internal _hub;
  PaymentBroker internal _broker;

  function _deployBroker() internal {
    _hub = new PaymentHub(address(this));
    _broker = new PaymentBroker(_router, address(_hub), address(this));
  }

  function _data(
    Id _laneId,
    address _onBehalf,
    uint256 _amount,
    uint256 _deadline
  )
    internal
    pure
    returns (bytes memory)
  {
    return abi.encode(_laneId, _onBehalf, _amount, _deadline);
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
