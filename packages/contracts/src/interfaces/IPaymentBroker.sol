// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentHub } from 'src/interfaces/IPaymentHub.sol';

/// @title IPaymentBroker
/// @notice A CCIP 2.0 receiver that turns allowlisted data-only messages into hub payments
interface IPaymentBroker {
  /// @notice A source pair was bound to a payer, or removed with the zero payer
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  /// @param _payer The payer the pair is bound to, zero when removed
  event AllowedSenderSet(uint64 indexed _sourceChainSelector, address indexed _sender, address _payer);

  /// @notice The pair is not allowed
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  error PaymentBroker_SourceNotAllowed(uint64 _sourceChainSelector, address _sender);

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

  /// @notice The hub the broker pays into
  /// @return _hub The hub
  function HUB() external view returns (IPaymentHub _hub);

  /// @notice The payer a source pair is bound to
  /// @param _sourceChainSelector The CCIP source chain selector
  /// @param _sender The sender on the source chain
  /// @return _payer The bound payer, zero when the pair is not allowed
  function payerOf(uint64 _sourceChainSelector, address _sender) external view returns (address _payer);
}
