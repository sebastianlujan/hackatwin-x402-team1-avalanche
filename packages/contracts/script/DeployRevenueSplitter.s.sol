// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import { SafeCast } from '@openzeppelin/contracts/utils/math/SafeCast.sol';
import { console } from 'forge-std/console.sol';

import { RevenueSplitter } from 'src/RevenueSplitter.sol';

import { Deploy } from 'script/Deploy.sol';
import { Registry } from 'script/lib/Registry.sol';

/// @title DeployRevenueSplitter
/// @notice Dry-run deploy of the revenue splitter on Fuji; sign with a keystore through --account
contract DeployRevenueSplitter is Deploy {
  string private constant _CHAIN = 'fuji';
  string private constant _KEY = 'fuji-revenue-splitter';
  string private constant _SNOWTRACE = 'https://testnet.snowtrace.io/address/';

  /// @notice Params for one deployment
  struct Inputs {
    address deployer;
    address seller;
    address platform;
    uint256 platformBps;
  }

  /// @notice Dry-run entry point; reads the directories from the environment
  function run() external {
    Inputs memory _in = load(Registry.registryDir(), _paramsDir());
    RevenueSplitter _splitter = deploy(_in);
    record(_in, _splitter, _deploymentsDir());
    console.log('RevenueSplitter %s', string.concat(_SNOWTRACE, vm.toString(address(_splitter))));
  }

  /// @notice Read the params, aborting before any transaction unless the chain is Fuji
  function load(string memory _registryDir, string memory _paramsDir_) public returns (Inputs memory _in) {
    _requireChain(_registryDir, _CHAIN);
    string memory _params = _readParams(_paramsDir_, _KEY);
    _in.deployer = _paramAddress(_params, _KEY, 'deployer');
    _in.seller = _paramAddress(_params, _KEY, 'seller');
    _in.platform = _paramAddress(_params, _KEY, 'platform');
    _in.platformBps = _paramUint(_params, _KEY, 'platformBps');
  }

  /// @notice Deploy the splitter as the deployer
  function deploy(Inputs memory _in) public returns (RevenueSplitter _splitter) {
    uint16 _platformBps = SafeCast.toUint16(_in.platformBps);
    vm.startBroadcast(_in.deployer);
    _splitter = new RevenueSplitter(_in.seller, _in.platform, _platformBps);
    vm.stopBroadcast();
  }

  /// @notice Write the splitter record, only in the broadcast context
  function record(Inputs memory _in, RevenueSplitter _splitter, string memory _dir) public {
    _writeRecord(_dir, _KEY, serialize(_in, _splitter));
  }

  /// @notice The splitter deployment record as JSON, read back from the deployed splitter
  function serialize(Inputs memory _in, RevenueSplitter _splitter) public returns (string memory _json) {
    string memory _obj = _KEY;
    vm.serializeUint(_obj, 'chainId', block.chainid);
    vm.serializeAddress(_obj, 'deployer', _in.deployer);
    vm.serializeAddress(_obj, 'splitter', address(_splitter));
    vm.serializeAddress(_obj, 'seller', _splitter.SELLER());
    vm.serializeAddress(_obj, 'platform', _splitter.PLATFORM());
    _json = vm.serializeUint(_obj, 'platformBps', _splitter.PLATFORM_BPS());
  }
}
