// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @title IERC20SendAndCallReceiver
/// @notice Receiver side of the ICTT sendAndCall flow, written from the documented ABI
interface IERC20SendAndCallReceiver {
  /// @notice Called by the token transferrer after it approves `_amount` of `_token` to this contract
  /// @param _sourceBlockchainID The blockchain the tokens were sent from
  /// @param _originTokenTransferrerAddress The transferrer that sent the tokens on the source chain
  /// @param _originSenderAddress The account that called sendAndCall on the source chain
  /// @param _token The ERC20 token being delivered
  /// @param _amount The token amount approved to this contract
  /// @param _payload The recipient payload chosen by the sender
  function receiveTokens(
    bytes32 _sourceBlockchainID,
    address _originTokenTransferrerAddress,
    address _originSenderAddress,
    address _token,
    uint256 _amount,
    bytes calldata _payload
  )
    external;
}
