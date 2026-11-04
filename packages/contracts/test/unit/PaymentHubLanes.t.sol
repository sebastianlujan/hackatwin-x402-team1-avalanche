// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubLanes {
  modifier whenTheOwnerEnablesAMessenger() {
    _;
  }

  function test_GivenTheCallerIsTheOwner() external whenTheOwnerEnablesAMessenger {
    // it emits MessengerEnabled and lets lanes use it
  }

  function test_GivenTheCallerIsNotTheOwner() external whenTheOwnerEnablesAMessenger {
    // it reverts with OwnableUnauthorizedAccount
  }

  function test_GivenTheMessengerIsTheZeroAddress() external whenTheOwnerEnablesAMessenger {
    // it reverts with PaymentHub_ZeroAddress
  }

  modifier whenTheOwnershipIsHandedOver() {
    _;
  }

  function test_GivenTheNewOwnerHasNotAccepted() external whenTheOwnershipIsHandedOver {
    // it keeps the old owner
  }

  modifier whenAnyoneCreatesALane() {
    _;
  }

  function test_GivenALocalLane() external whenAnyoneCreatesALane {
    // it stores the lane under its id and emits LaneCreated
  }

  function test_GivenACrossChainLaneWithAnEnabledMessenger() external whenAnyoneCreatesALane {
    // it stores the lane under its id and emits LaneCreated
  }

  function test_GivenAMessengerThatWasNeverEnabled() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_MessengerNotEnabled
  }

  function test_GivenAZeroToken() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_ZeroAddress
  }

  function test_GivenAZeroMerchant() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_ZeroAddress
  }

  function test_GivenALocalLaneWithADestination() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_InvalidLane
  }

  function test_GivenACrossChainLaneWithoutADestination() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_InvalidLane
  }

  function test_GivenADuplicateLane() external whenAnyoneCreatesALane {
    // it reverts with PaymentHub_LaneExists
  }
}
