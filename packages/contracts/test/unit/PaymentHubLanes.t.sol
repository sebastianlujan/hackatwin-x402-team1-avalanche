// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';
import { Test } from 'forge-std/Test.sol';

import { IPaymentHub, Id } from 'src/interfaces/IPaymentHub.sol';
import { LaneParamsLib } from 'src/libraries/LaneParamsLib.sol';
import { PaymentHubHarness } from 'test/utils/PaymentHubHarness.sol';

contract UnitPaymentHubLanes is Test {
  address internal _owner = makeAddr('owner');
  address internal _stranger = makeAddr('stranger');
  address internal _messenger = makeAddr('messenger');
  address internal _token = makeAddr('token');
  address internal _merchant = makeAddr('merchant');
  bytes32 internal _destination = keccak256('destination');

  PaymentHubHarness internal _hub;

  function setUp() external {
    _hub = new PaymentHubHarness(_owner);
  }

  modifier whenTheOwnerEnablesAMessenger() {
    _;
  }

  function test_GivenTheCallerIsTheOwner() external whenTheOwnerEnablesAMessenger {
    // it emits MessengerEnabled and lets lanes use it
    vm.expectEmit(true, false, false, false, address(_hub));
    emit IPaymentHub.MessengerEnabled(_messenger);
    vm.prank(_owner);
    _hub.enableMessenger(_messenger);
    assertTrue(_hub.exposed_isMessengerEnabled(_messenger));

    IPaymentHub.LaneParams memory _params = _lane(_messenger, _destination);
    Id _id = _hub.createLane(_params);
    assertEq(Id.unwrap(_id), Id.unwrap(LaneParamsLib.id(_params)));
  }

  function test_GivenTheCallerIsNotTheOwner() external whenTheOwnerEnablesAMessenger {
    // it reverts with OwnableUnauthorizedAccount
    vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, _stranger));
    vm.prank(_stranger);
    _hub.enableMessenger(_messenger);
    assertFalse(_hub.exposed_isMessengerEnabled(_messenger));
  }

  function test_GivenTheMessengerIsTheZeroAddress() external whenTheOwnerEnablesAMessenger {
    // it reverts with PaymentHub_ZeroAddress
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAddress.selector);
    vm.prank(_owner);
    _hub.enableMessenger(address(0));
  }

  modifier whenTheOwnershipIsHandedOver() {
    _;
  }

  function test_GivenTheNewOwnerHasNotAccepted() external whenTheOwnershipIsHandedOver {
    // it keeps the old owner
    vm.prank(_owner);
    _hub.transferOwnership(_stranger);
    assertEq(_hub.owner(), _owner);
    assertEq(_hub.pendingOwner(), _stranger);

    vm.prank(_stranger);
    _hub.acceptOwnership();
    assertEq(_hub.owner(), _stranger);
  }

  modifier whenAnyoneCreatesALane() {
    _;
  }

  function test_GivenALocalLane() external whenAnyoneCreatesALane {
    // it stores the lane under its id and emits LaneCreated
    IPaymentHub.LaneParams memory _params = _lane(address(0), bytes32(0));
    Id _expected = LaneParamsLib.id(_params);

    vm.expectEmit(true, false, false, true, address(_hub));
    emit IPaymentHub.LaneCreated(_expected, _params);
    vm.prank(_stranger);
    Id _id = _hub.createLane(_params);

    assertEq(Id.unwrap(_id), Id.unwrap(_expected));
    IPaymentHub.LaneParams memory _stored = _hub.exposed_lane(_id);
    assertEq(_stored.token, _token);
    assertEq(_stored.merchant, _merchant);
    assertEq(_stored.messenger, address(0));
    assertEq(_stored.destination, bytes32(0));
  }

  function test_GivenACrossChainLaneWithAnEnabledMessenger() external whenAnyoneCreatesALane {
    // it stores the lane under its id and emits LaneCreated
    vm.prank(_owner);
    _hub.enableMessenger(_messenger);
    IPaymentHub.LaneParams memory _params = _lane(_messenger, _destination);
    Id _expected = LaneParamsLib.id(_params);

    vm.expectEmit(true, false, false, true, address(_hub));
    emit IPaymentHub.LaneCreated(_expected, _params);
    Id _id = _hub.createLane(_params);

    assertEq(Id.unwrap(_id), Id.unwrap(_expected));
    IPaymentHub.LaneParams memory _stored = _hub.exposed_lane(_id);
    assertEq(_stored.messenger, _messenger);
    assertEq(_stored.destination, _destination);
  }

  function test_GivenAMessengerThatWasNeverEnabled() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_MessengerNotEnabled
    vm.expectRevert(abi.encodeWithSelector(IPaymentHub.PaymentHub_MessengerNotEnabled.selector, _messenger));
    _hub.createLane(_lane(_messenger, _destination));
  }

  function test_GivenAZeroToken() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_ZeroAddress
    IPaymentHub.LaneParams memory _params = _lane(address(0), bytes32(0));
    _params.token = address(0);
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAddress.selector);
    _hub.createLane(_params);
  }

  function test_GivenAZeroMerchant() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_ZeroAddress
    IPaymentHub.LaneParams memory _params = _lane(address(0), bytes32(0));
    _params.merchant = address(0);
    vm.expectRevert(IPaymentHub.PaymentHub_ZeroAddress.selector);
    _hub.createLane(_params);
  }

  function test_GivenALocalLaneWithADestination() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_InvalidLane
    vm.expectRevert(IPaymentHub.PaymentHub_InvalidLane.selector);
    _hub.createLane(_lane(address(0), _destination));
  }

  function test_GivenACrossChainLaneWithoutADestination() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_InvalidLane
    vm.prank(_owner);
    _hub.enableMessenger(_messenger);
    vm.expectRevert(IPaymentHub.PaymentHub_InvalidLane.selector);
    _hub.createLane(_lane(_messenger, bytes32(0)));
  }

  function test_GivenADuplicateLane() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_LaneExists
    IPaymentHub.LaneParams memory _params = _lane(address(0), bytes32(0));
    _hub.createLane(_params);
    vm.expectRevert(IPaymentHub.PaymentHub_LaneExists.selector);
    _hub.createLane(_params);
  }

  function _lane(address _m, bytes32 _d) internal view returns (IPaymentHub.LaneParams memory _params) {
    _params = IPaymentHub.LaneParams({ token: _token, merchant: _merchant, messenger: _m, destination: _d });
  }
}
