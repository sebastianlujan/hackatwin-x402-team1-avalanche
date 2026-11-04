// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';
import { BrokerFixture } from 'test/utils/BrokerFixture.sol';

contract GasPaymentBroker is BrokerFixture {
  // The documented CCIP gasLimit the accept path must fit
  uint256 internal constant _CCIP_GAS_LIMIT = 800_000;

  function setUp() external {
    _deployBroker();
    _broker.setAllowedSender(_SELECTOR_A, _senderX, _payerP);
  }

  modifier whenTheBrokerHotPathsRunOnFreshState() {
    _;
  }

  function test_GivenAnAcceptedMessage() external whenTheBrokerHotPathsRunOnFreshState {
    // it accepts and the gas lands in the snapshot
    // it fits the documented gas limit
    uint256 _before = gasleft();
    _receive(keccak256('accepted'));
    uint256 _used = _before - gasleft();

    assertEq(uint8(_broker.statusOf(keccak256('accepted'))), uint8(IPaymentBroker.Status.Accepted));
    assertLt(_used, _CCIP_GAS_LIMIT);
  }

  function test_GivenARejectedMessage() external whenTheBrokerHotPathsRunOnFreshState {
    // it rejects and the gas lands in the snapshot
    _hub.exposed_setBudget(_payerP, address(_broker), address(_token), 1);
    _receive(keccak256('rejected'));
    assertEq(uint8(_broker.statusOf(keccak256('rejected'))), uint8(IPaymentBroker.Status.Rejected));
  }

  function _receive(bytes32 _id) internal {
    vm.prank(_router);
    _broker.ccipReceive{ gas: _CCIP_GAS_LIMIT }(_message(_id, _SELECTOR_A, _senderX, _valid(_payerP)));
  }
}
