// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice A verified inbound Warp message
struct WarpMessage {
  bytes32 sourceChainID;
  address originSenderAddress;
  bytes payload;
}

/// @notice Test-only stand-in for the Warp precompile, which anvil lacks
/// @dev Storage only (no immutables) so the runtime code can be installed with `anvil_setCode`
contract WarpMessengerStub {
  /// @notice Emitted by `sendWarpMessage`, carrying the exact payload bytes
  event WarpMessageSent(bytes32 indexed messageID, bytes message);

  bytes32 internal _blockchainID;
  bytes[] internal _sent;
  mapping(uint32 index => WarpMessage message) internal _verified;
  mapping(uint32 index => bool injected) internal _injected;

  /// @notice Configure the blockchain ID this stub reports
  function setBlockchainID(bytes32 _id) external {
    _blockchainID = _id;
  }

  /// @notice Record a payload and return its message ID
  function sendWarpMessage(bytes calldata _payload) external returns (bytes32 _messageID) {
    _messageID = nextMessageID(_payload);
    _sent.push(_payload);
    emit WarpMessageSent(_messageID, _payload);
  }

  /// @notice Inject a message that `getVerifiedWarpMessage(_index)` then returns as valid
  function setVerifiedMessage(
    uint32 _index,
    bytes32 _sourceChainID,
    address _originSender,
    bytes calldata _payload
  )
    external
  {
    _verified[_index] = WarpMessage(_sourceChainID, _originSender, _payload);
    _injected[_index] = true;
  }

  /// @notice The blockchain ID of the chain this stub stands for
  function getBlockchainID() external view returns (bytes32) {
    return _blockchainID;
  }

  /// @notice The injected message at an index, with `valid` false when none was injected
  function getVerifiedWarpMessage(uint32 _index) external view returns (WarpMessage memory _message, bool _valid) {
    _valid = _injected[_index];
    if (_valid) _message = _verified[_index];
  }

  /// @notice The message ID the next send of `_payload` returns
  function nextMessageID(bytes calldata _payload) public view returns (bytes32) {
    return keccak256(abi.encode(_blockchainID, _sent.length, _payload));
  }

  /// @notice How many payloads were sent
  function sentCount() external view returns (uint256) {
    return _sent.length;
  }

  /// @notice The payload sent at `_index`, in send order
  function sentMessage(uint256 _index) external view returns (bytes memory) {
    return _sent[_index];
  }
}
