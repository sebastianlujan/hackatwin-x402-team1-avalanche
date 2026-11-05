// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { CCIPReceiver } from '@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol';
import { Test } from 'forge-std/Test.sol';

import { PaymentBroker } from 'src/PaymentBroker.sol';
import { IPaymentBroker } from 'src/interfaces/IPaymentBroker.sol';

contract UnitPaymentBrokerConstructor is Test {
  address internal _router = makeAddr('router');
  address internal _hub = makeAddr('hub');
  address internal _owner = makeAddr('owner');

  modifier whenDeployingTheBroker() {
    _;
  }

  function test_GivenAZeroHub() external whenDeployingTheBroker {
    // it reverts with PaymentBroker_ZeroAddress
    vm.expectRevert(IPaymentBroker.PaymentBroker_ZeroAddress.selector);
    new PaymentBroker(_router, address(0), _owner);
  }

  function test_GivenAZeroRouter() external whenDeployingTheBroker {
    // it reverts with InvalidRouter
    vm.expectRevert(abi.encodeWithSelector(CCIPReceiver.InvalidRouter.selector, address(0)));
    new PaymentBroker(address(0), _hub, _owner);
  }

  function test_GivenARouterAHubAndAnOwner() external whenDeployingTheBroker {
    // it stores the hub and the owner
    PaymentBroker _broker = new PaymentBroker(_router, _hub, _owner);
    assertEq(address(_broker.HUB()), _hub);
    assertEq(_broker.getRouter(), _router);
    assertEq(_broker.owner(), _owner);
    address _other = makeAddr('other');
    _broker = new PaymentBroker(_other, _other, _other);
    assertEq(address(_broker.HUB()), _other);
  }
}
