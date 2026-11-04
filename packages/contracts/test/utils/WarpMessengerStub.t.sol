// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { WarpMessage, WarpMessengerStub } from 'test/utils/WarpMessengerStub.sol';

contract UnitWarpMessengerStub is Test {
  bytes32 internal constant _CHAIN_ID = keccak256('local-hub');
  bytes32 internal constant _OTHER_CHAIN_ID = keccak256('local-l1');
  bytes32 internal constant _SOURCE = keccak256('source-chain');

  WarpMessengerStub internal _stub;

  event WarpMessageSent(bytes32 indexed messageID, bytes message);

  function setUp() public {
    _stub = new WarpMessengerStub();
    _stub.setBlockchainID(_CHAIN_ID);
  }

  modifier whenReadingTheBlockchainID() {
    _;
  }

  function test_GivenAnIDWasConfigured() external view whenReadingTheBlockchainID {
    // it returns the configured ID
    assertEq(_stub.getBlockchainID(), _CHAIN_ID);
  }

  function test_GivenTheIDWasChangedAgain() external whenReadingTheBlockchainID {
    // it returns the latest ID
    _stub.setBlockchainID(_OTHER_CHAIN_ID);
    assertEq(_stub.getBlockchainID(), _OTHER_CHAIN_ID);
  }

  modifier whenSendingAWarpMessage() {
    _;
  }

  function test_GivenOnePayload() external whenSendingAWarpMessage {
    bytes memory payload = hex'c0ffee';
    bytes32 expectedId = _stub.nextMessageID(payload);

    // it emits WarpMessageSent
    vm.expectEmit(true, false, false, true, address(_stub));
    emit WarpMessageSent(expectedId, payload);
    bytes32 id = _stub.sendWarpMessage(payload);

    // it returns a message ID
    assertEq(id, expectedId);
    assertTrue(id != bytes32(0));
    // it records the payload
    assertEq(_stub.sentCount(), 1);
    assertEq(_stub.sentMessage(0), payload);
  }

  function test_GivenTwoDifferentPayloadsInOrder() external whenSendingAWarpMessage {
    bytes32 firstId = _stub.sendWarpMessage(hex'01');
    bytes32 secondId = _stub.sendWarpMessage(hex'0202');

    // it records both in send order
    assertEq(_stub.sentCount(), 2);
    assertEq(_stub.sentMessage(0), hex'01');
    assertEq(_stub.sentMessage(1), hex'0202');
    // it returns different IDs
    assertTrue(firstId != secondId);
  }

  modifier whenReadingAVerifiedMessage() {
    _;
  }

  function test_GivenAMessageInjectedAtIndex0() external whenReadingAVerifiedMessage {
    _stub.setVerifiedMessage(0, _SOURCE, address(0xBEEF), hex'abcd');

    (WarpMessage memory message, bool valid) = _stub.getVerifiedWarpMessage(0);

    // it returns the message with valid true
    assertTrue(valid);
    assertEq(message.sourceChainID, _SOURCE);
    assertEq(message.originSenderAddress, address(0xBEEF));
    assertEq(message.payload, hex'abcd');
  }

  function test_GivenNothingInjectedAtTheIndex() external whenReadingAVerifiedMessage {
    _stub.setVerifiedMessage(0, _SOURCE, address(0xBEEF), hex'abcd');

    (WarpMessage memory message, bool valid) = _stub.getVerifiedWarpMessage(1);

    // it returns valid false
    assertFalse(valid);
    assertEq(message.sourceChainID, bytes32(0));
    assertEq(message.payload.length, 0);
  }

  function test_GivenIndex0AlreadyHoldsAMessage() external whenReadingAVerifiedMessage {
    _stub.setVerifiedMessage(0, _SOURCE, address(0xBEEF), hex'abcd');
    _stub.setVerifiedMessage(0, _OTHER_CHAIN_ID, address(0xCAFE), hex'01');

    (WarpMessage memory message, bool valid) = _stub.getVerifiedWarpMessage(0);

    // it returns the second message after an overwrite
    assertTrue(valid);
    assertEq(message.sourceChainID, _OTHER_CHAIN_ID);
    assertEq(message.originSenderAddress, address(0xCAFE));
    assertEq(message.payload, hex'01');
  }
}
