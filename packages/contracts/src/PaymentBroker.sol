// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { CCIPReceiver } from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { Ownable, Ownable2Step } from '@openzeppelin/contracts/access/Ownable2Step.sol';

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';

/// @title PaymentBroker
/// @notice The Fuji CCIP receiver that only acts inside the router-restricted receive hook
contract PaymentBroker is IPaymentBroker, CCIPReceiver, Ownable2Step {
  /// @notice The exact size of the encoded laneId, onBehalf, amount and deadline
  uint256 internal constant _PAYLOAD_SIZE = 128;

  /// @inheritdoc IPaymentBroker
  IPaymentHub public immutable HUB;

  /// @notice The payer each allowed source pair is bound to
  mapping(uint64 _sourceChainSelector => mapping(address _sender => address _payer)) internal _payers;

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

  /// @inheritdoc CCIPReceiver
  function _ccipReceive(Client.Any2EVMMessage memory _message) internal override {
    uint64 _selector = _message.sourceChainSelector;
    address _sender = abi.decode(_message.sender, (address));
    if (_payers[_selector][_sender] == address(0)) revert PaymentBroker_SourceNotAllowed(_selector, _sender);
    if (_message.destTokenAmounts.length != 0) revert PaymentBroker_UnexpectedTokens();
    if (_message.data.length != _PAYLOAD_SIZE) revert PaymentBroker_InvalidPayload();
  }
}
