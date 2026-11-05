// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';

/// @title IPaymentBroker
/// @notice A CCIP 2.0 receiver that turns allowlisted data-only messages into hub payments
interface IPaymentBroker {
  /// @notice Message states keyed by CCIP message id; None is the default for an unknown message
  enum Status {
    None,
    Accepted,
    Rejected
  }

  /// @notice A source pair was bound to a payer, or removed with the zero payer
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  /// @param _payer The payer the pair is bound to, zero when removed
  event AllowedSenderSet(uint64 indexed _sourceChainSelector, address indexed _sender, address _payer);

  /// @notice A message created a hub payment, which was dispatched
  /// @param _messageId The CCIP message id
  /// @param _laneId The hub lane
  /// @param _paymentId The hub payment id
  event MessageAccepted(bytes32 indexed _messageId, Id indexed _laneId, bytes32 _paymentId);

  /// @notice The payment exists but its dispatch failed; anyone can dispatch it before its deadline
  /// @param _messageId The CCIP message id
  /// @param _paymentId The pending hub payment id
  /// @param _reason The first four bytes of the revert data, zero when shorter
  event DispatchFailed(bytes32 indexed _messageId, bytes32 _paymentId, bytes4 _reason);

  /// @notice A message was refused and recorded without reverting
  /// @param _messageId The CCIP message id
  /// @param _reason The first four bytes of the revert data, zero when shorter
  event MessageRejected(bytes32 indexed _messageId, bytes4 _reason);

  /// @notice The pair is not allowed
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  error PaymentBroker_SourceNotAllowed(uint64 _sourceChainSelector, address _sender);

  /// @notice The message id was already processed
  /// @param _messageId The CCIP message id
  error PaymentBroker_MessageAlreadyProcessed(bytes32 _messageId);

  /// @notice Too little gas is left to run the hub calls, so the message can be re-executed
  /// @param _available The gas left
  /// @param _required The minimum gas needed
  error PaymentBroker_InsufficientGas(uint256 _available, uint256 _required);

  /// @notice The payload payer differs from the payer bound to the pair, used only as a rejection reason
  /// @param _expected The payer bound to the pair
  /// @param _actual The payload payer
  error PaymentBroker_PayerMismatch(address _expected, address _actual);

  /// @notice The message carries tokens
  error PaymentBroker_UnexpectedTokens();

  /// @notice The data is not exactly the four encoded words
  error PaymentBroker_InvalidPayload();

  /// @notice The sender is the zero address
  error PaymentBroker_ZeroAddress();

  /// @notice Bind a source pair to one payer, or remove it with the zero payer
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  /// @param _payer The payer whose budget the pair may spend, zero to remove the pair
  function setAllowedSender(uint64 _sourceChainSelector, address _sender, address _payer) external;

  /// @notice The minimum gas left before the hub calls
  /// @return _gas The gas floor
  function MIN_RELAY_GAS() external view returns (uint256 _gas);

  /// @notice The hub the broker pays into
  /// @return _hub The hub
  function HUB() external view returns (IPaymentHub _hub);

  /// @notice The payer a source pair is bound to
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  /// @return _payer The bound payer, zero when the pair is not allowed
  function payerOf(uint64 _sourceChainSelector, address _sender) external view returns (address _payer);

  /// @notice The recorded status of a message
  /// @param _messageId The CCIP message id
  /// @return _status The status, None for an unknown message
  function statusOf(bytes32 _messageId) external view returns (Status _status);
}
