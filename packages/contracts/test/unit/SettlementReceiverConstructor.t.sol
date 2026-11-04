// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Test } from 'forge-std/Test.sol';

import { SettlementReceiver } from 'src/SettlementReceiver.sol';
import { ISettlementReceiver } from 'src/interfaces/ISettlementReceiver.sol';

contract UnitSettlementReceiverConstructor is Test {
  bytes32 internal constant _SOURCE = keccak256('fuji');

  address internal _transferrer = makeAddr('transferrer');
  address internal _originTransferrer = makeAddr('originTransferrer');
  address internal _originSender = makeAddr('originSender');
  address internal _token = makeAddr('token');
  address internal _owner = makeAddr('owner');

  modifier whenDeployingTheReceiver() {
    _;
  }

  function test_GivenAZeroTransferrer() external whenDeployingTheReceiver {
    // it reverts with SettlementReceiver_ZeroAddress
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAddress.selector);
    new SettlementReceiver(address(0), _SOURCE, _originTransferrer, _originSender, _token, _owner);
  }

  function test_GivenAZeroOriginTransferrer() external whenDeployingTheReceiver {
    // it reverts with SettlementReceiver_ZeroAddress
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAddress.selector);
    new SettlementReceiver(_transferrer, _SOURCE, address(0), _originSender, _token, _owner);
  }

  function test_GivenAZeroOriginSender() external whenDeployingTheReceiver {
    // it reverts with SettlementReceiver_ZeroAddress
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAddress.selector);
    new SettlementReceiver(_transferrer, _SOURCE, _originTransferrer, address(0), _token, _owner);
  }

  function test_GivenAZeroToken() external whenDeployingTheReceiver {
    // it reverts with SettlementReceiver_ZeroAddress
    vm.expectRevert(ISettlementReceiver.SettlementReceiver_ZeroAddress.selector);
    new SettlementReceiver(_transferrer, _SOURCE, _originTransferrer, _originSender, address(0), _owner);
  }

  function test_GivenEveryAddressSet() external whenDeployingTheReceiver {
    // it stores each address
    SettlementReceiver _receiver =
      new SettlementReceiver(_transferrer, _SOURCE, _originTransferrer, _originSender, _token, _owner);
    assertEq(_receiver.TRANSFERRER(), _transferrer);
    assertEq(_receiver.ORIGIN_TRANSFERRER(), _originTransferrer);
    assertEq(_receiver.ORIGIN_SENDER(), _originSender);
    assertEq(_receiver.TOKEN(), _token);
    assertEq(_receiver.owner(), _owner);
  }
}
