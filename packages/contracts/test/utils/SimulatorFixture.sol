// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { IRouterClient } from '@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol';
import { Client } from '@chainlink/contracts-ccip/contracts/libraries/Client.sol';
import { ExtraArgsCodec } from '@chainlink/contracts-ccip/contracts/libraries/ExtraArgsCodec.sol';
import { CCIPLocalRouter } from '@chainlink/local/src/ccip/CCIPLocalRouter.sol';
import { CCIPLocalSimulator } from '@chainlink/local/src/ccip/CCIPLocalSimulator.sol';

import { BrokerFixture } from 'test/utils/BrokerFixture.sol';

/// @notice The broker fixture wired to the CCIPLocalSimulator router instead of a fake router address
abstract contract SimulatorFixture is BrokerFixture {
  uint32 internal constant _GAS_LIMIT = 800_000;
  uint16 internal constant _EXACT_GAS_CHECK = 5000;

  CCIPLocalRouter internal _ccipRouter;
  uint64 internal _selector;
  address internal _agent = makeAddr('agent');

  function _deploySimulator() internal {
    CCIPLocalSimulator _simulator = new CCIPLocalSimulator();
    IRouterClient _client;
    (_selector, _client,,,,,) = _simulator.configuration();
    _ccipRouter = CCIPLocalRouter(address(_client));
    _router = address(_client);
    _deployBroker();
    _broker.setAllowedSender(_selector, _agent, _payerP);
  }

  function _send(address _from, bytes memory _payload) internal returns (bytes32 _id) {
    Client.EVM2AnyMessage memory _sent = Client.EVM2AnyMessage(
      abi.encode(address(_broker)),
      _payload,
      new Client.EVMTokenAmount[](0),
      address(0),
      ExtraArgsCodec._getBasicEncodedExtraArgsV3(_GAS_LIMIT, bytes4(0))
    );
    vm.prank(_from);
    _id = _ccipRouter.ccipSend(_selector, _sent);
  }

  function _replay(bytes32 _id, address _from, bytes memory _payload) internal returns (bool _ok, bytes memory _error) {
    (_ok, _error,) = _ccipRouter.routeMessage(
      _message(_id, _selector, _from, _payload), _EXACT_GAS_CHECK, _GAS_LIMIT, address(_broker)
    );
  }
}
