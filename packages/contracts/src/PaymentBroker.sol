// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { CCIPReceiver } from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { Ownable, Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @title PaymentBroker
/// @notice The Fuji CCIP receiver that only acts inside the router-restricted receive hook
contract PaymentBroker is IPaymentBroker, CCIPReceiver, Ownable2Step {
  /// @notice The exact size of the encoded laneId, onBehalf, amount and deadline
  uint256 internal constant _PAYLOAD_SIZE = 128;

  /// @inheritdoc IPaymentBroker
  uint256 public constant MIN_RELAY_GAS = 500_000;

  /// @inheritdoc IPaymentBroker
  IPaymentHub public immutable HUB;

  /// @notice The payer each allowed source pair is bound to
  mapping(uint64 _sourceChainSelector => mapping(address _sender => address _payer)) internal _payers;

  /// @notice The final status of each processed message
  mapping(bytes32 _messageId => Status _status) internal _statuses;

  /// @param _router The CCIP router, the only caller of the receive hook
  /// @param _hub The payment hub
  /// @param _owner The owner, who only manages the allowlist
  constructor(address _router, address _hub, address _owner) CCIPReceiver(_router) Ownable(_owner) {
    HUB = IPaymentHub(_hub);
  }

  /// @inheritdoc IPaymentBroker
  function setAllowedSender(uint64 _sourceChainSelector, address _sender, address _payer) external onlyOwner {
    if (_sender == address(0)) revert PaymentBroker_ZeroAddress();
    _payers[_sourceChainSelector][_sender] = _payer;
    emit AllowedSenderSet(_sourceChainSelector, _sender, _payer);
  }

  /// @inheritdoc IPaymentBroker
  function payerOf(uint64 _sourceChainSelector, address _sender) external view returns (address _payer) {
    _payer = _payers[_sourceChainSelector][_sender];
  }

  /// @inheritdoc IPaymentBroker
  function statusOf(bytes32 _messageId) external view returns (Status _status) {
    _status = _statuses[_messageId];
  }

  /// @inheritdoc CCIPReceiver
  function _ccipReceive(Client.Any2EVMMessage memory _message) internal override {
    uint64 _selector = _message.sourceChainSelector;
    address _sender = abi.decode(_message.sender, (address));
    address _payer = _payers[_selector][_sender];
    if (_payer == address(0)) revert PaymentBroker_SourceNotAllowed(_selector, _sender);
    bytes32 _messageId = _message.messageId;
    if (_statuses[_messageId] != Status.None) revert PaymentBroker_MessageAlreadyProcessed(_messageId);
    if (_message.destTokenAmounts.length != 0) revert PaymentBroker_UnexpectedTokens();
    if (_message.data.length != _PAYLOAD_SIZE) revert PaymentBroker_InvalidPayload();

    (Id _laneId, uint256 _word, uint256 _amount, uint256 _deadline) =
      abi.decode(_message.data, (Id, uint256, uint256, uint256));
    if (_word >> 160 != 0) revert PaymentBroker_InvalidPayload();
    address _onBehalf = address(uint160(_word));

    if (_onBehalf != _payer) {
      _statuses[_messageId] = Status.Rejected;
      emit MessageRejected(_messageId, PaymentBroker_PayerMismatch.selector);
      return;
    }

    uint256 _available = gasleft();
    if (_available < MIN_RELAY_GAS) revert PaymentBroker_InsufficientGas(_available, MIN_RELAY_GAS);

    bytes32 _paymentId;
    try HUB.pay(_laneId, _onBehalf, _amount, _deadline) returns (bytes32 _id) {
      _paymentId = _id;
    } catch (bytes memory _reason) {
      _statuses[_messageId] = Status.Rejected;
      emit MessageRejected(_messageId, _selectorOf(_reason));
      return;
    }
    _statuses[_messageId] = Status.Accepted;
    try HUB.dispatch(_laneId, _paymentId) {
      emit MessageAccepted(_messageId, _laneId, _paymentId);
    } catch (bytes memory _reason) {
      emit DispatchFailed(_messageId, _paymentId, _selectorOf(_reason));
    }
  }

  /// @notice The first four bytes of revert data
  /// @param _revert The revert data
  /// @return _selector The selector, zero when the data is shorter than four bytes
  function _selectorOf(bytes memory _revert) internal pure returns (bytes4 _selector) {
    if (_revert.length >= 4) _selector = bytes4(_revert);
  }
}
