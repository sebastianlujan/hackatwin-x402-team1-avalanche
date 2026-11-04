// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

contract UnitPaymentHubTransition {
  modifier whenATransitionIsRequested() {
    _;
  }

  function test_GivenTheStoredStatusEqualsTheFromStatusAndTheEdgeIsInTheTable() external whenATransitionIsRequested {
    // it writes the status and emits exactly one StatusChanged
  }

  function test_GivenTheStoredStatusDiffersFromTheFromStatus() external whenATransitionIsRequested {
    // it reverts with PaymentHub_InvalidTransition and emits nothing
  }

  function test_GivenTheEdgeIsNotInTheTable() external whenATransitionIsRequested {
    // it reverts with PaymentHub_InvalidTransition
  }

  function test_WhenAnUnknownPaymentIsRead() external {
    // it reads as None
  }
}
