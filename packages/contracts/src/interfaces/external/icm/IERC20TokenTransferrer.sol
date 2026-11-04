// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Arguments of an ICTT sendAndCall, in the documented field order
/// @param destinationBlockchainID The destination blockchain
/// @param destinationTokenTransferrerAddress The transferrer on the destination chain
/// @param recipientContract The contract called with the tokens
/// @param recipientPayload The payload passed to the recipient
/// @param requiredGasLimit The gas the relayer must supply for the whole delivery
/// @param recipientGasLimit The gas forwarded to the recipient call
/// @param multiHopFallback The fallback for multi-hop sends
/// @param fallbackRecipient The account that receives the tokens when the call fails or is not pulled
/// @param primaryFeeTokenAddress The token used for the primary relayer fee
/// @param primaryFee The primary relayer fee
/// @param secondaryFee The secondary relayer fee for multi-hop
struct SendAndCallInput {
  bytes32 destinationBlockchainID;
  address destinationTokenTransferrerAddress;
  address recipientContract;
  bytes recipientPayload;
  uint256 requiredGasLimit;
  uint256 recipientGasLimit;
  address multiHopFallback;
  address fallbackRecipient;
  address primaryFeeTokenAddress;
  uint256 primaryFee;
  uint256 secondaryFee;
}

/// @title IERC20TokenTransferrer
/// @notice The only ICTT entry point we call, written from the documented ABI
interface IERC20TokenTransferrer {
  /// @notice Pull `_amount` tokens from the caller and send them with a call to the recipient contract
  /// @param _input The send and call arguments
  /// @param _amount The token amount to send
  function sendAndCall(SendAndCallInput calldata _input, uint256 _amount) external;
}
