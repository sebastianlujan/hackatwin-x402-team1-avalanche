// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { IERC20SendAndCallReceiver } from 'src/interfaces/external/icm/IERC20SendAndCallReceiver.sol';
import { IERC20TokenTransferrer, SendAndCallInput } from 'src/interfaces/external/icm/IERC20TokenTransferrer.sol';

contract UnitIcmInterfaces is Test {
  bytes4 internal constant _RECEIVE_TOKENS_SELECTOR = 0x94395edd;
  bytes4 internal constant _SEND_AND_CALL_SELECTOR = 0x65690038;
  string internal constant _TUPLE =
    '(bytes32,address,address,bytes,uint256,uint256,address,address,address,uint256,uint256)';
  // destinationBlockchainID and recipientPayload swapped
  string internal constant _SWAPPED =
    '(bytes,address,address,bytes32,uint256,uint256,address,address,address,uint256,uint256)';

  // Same field types as SendAndCallInput under other names, so a rename or reorder in src is caught here
  struct PinnedLayout {
    bytes32 a;
    address b;
    address c;
    bytes d;
    uint256 e;
    uint256 f;
    address g;
    address h;
    address i;
    uint256 j;
    uint256 k;
  }

  modifier whenCheckingThePinnedSelectors() {
    _;
  }

  function test_GivenTheReceiveTokensFunction() external whenCheckingThePinnedSelectors {
    // it matches the literal selector
    assertEq(IERC20SendAndCallReceiver.receiveTokens.selector, _RECEIVE_TOKENS_SELECTOR);
    assertEq(
      bytes4(keccak256('receiveTokens(bytes32,address,address,address,uint256,bytes)')), _RECEIVE_TOKENS_SELECTOR
    );
  }

  function test_GivenTheSendAndCallFunction() external whenCheckingThePinnedSelectors {
    // it matches the literal selector
    assertEq(IERC20TokenTransferrer.sendAndCall.selector, _SEND_AND_CALL_SELECTOR);
  }

  modifier whenCheckingTheStructLayout() {
    _;
  }

  function test_GivenTheCanonicalTupleTypeString() external whenCheckingTheStructLayout {
    // it reproduces the interface selector
    assertEq(
      bytes4(keccak256(bytes(string.concat('sendAndCall(', _TUPLE, ',uint256)')))),
      IERC20TokenTransferrer.sendAndCall.selector
    );
  }

  function test_GivenTwoFieldsSwapped() external whenCheckingTheStructLayout {
    // it no longer reproduces the interface selector
    bytes4 _swapped = bytes4(keccak256(bytes(string.concat('sendAndCall(', _SWAPPED, ',uint256)'))));
    assertTrue(_swapped != IERC20TokenTransferrer.sendAndCall.selector);
    assertTrue(_swapped != _SEND_AND_CALL_SELECTOR);
  }

  function test_WhenEncodingACall() external pure {
    // it decodes every field with the pinned layout
    SendAndCallInput memory _input = SendAndCallInput({
      destinationBlockchainID: bytes32(uint256(1)),
      destinationTokenTransferrerAddress: address(0xA2),
      recipientContract: address(0xA3),
      recipientPayload: hex'c0ffee',
      requiredGasLimit: 400_000,
      recipientGasLimit: 250_000,
      multiHopFallback: address(0xA4),
      fallbackRecipient: address(0xA5),
      primaryFeeTokenAddress: address(0xA6),
      primaryFee: 7,
      secondaryFee: 8
    });
    bytes memory _call = abi.encodeCall(IERC20TokenTransferrer.sendAndCall, (_input, 99));
    bytes memory _args = new bytes(_call.length - 4);
    for (uint256 _i; _i < _args.length; ++_i) {
      _args[_i] = _call[_i + 4];
    }
    (PinnedLayout memory _decoded, uint256 _amount) = abi.decode(_args, (PinnedLayout, uint256));
    assertEq(bytes4(_call), _SEND_AND_CALL_SELECTOR);
    assertEq(_decoded.a, _input.destinationBlockchainID);
    assertEq(_decoded.b, _input.destinationTokenTransferrerAddress);
    assertEq(_decoded.c, _input.recipientContract);
    assertEq(_decoded.d, _input.recipientPayload);
    assertEq(_decoded.e, _input.requiredGasLimit);
    assertEq(_decoded.f, _input.recipientGasLimit);
    assertEq(_decoded.g, _input.multiHopFallback);
    assertEq(_decoded.h, _input.fallbackRecipient);
    assertEq(_decoded.i, _input.primaryFeeTokenAddress);
    assertEq(_decoded.j, _input.primaryFee);
    assertEq(_decoded.k, _input.secondaryFee);
    assertEq(_amount, 99);
  }
}
