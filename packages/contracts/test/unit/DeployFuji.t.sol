// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitDeployFuji {
    modifier whenLoadingTheFujiInputs() {
        _;
    }

    function test_GivenFixturesWithEveryFactAndParameter() external whenLoadingTheFujiInputs {
        // it resolves facts from the registry and choices from params
    }

    function test_GivenARegistryWithoutAnEntry() external whenLoadingTheFujiInputs {
        // it reverts with EntryNotFound naming the key and the entry
    }

    function test_GivenAParamsFileWithoutAParameter() external whenLoadingTheFujiInputs {
        // it reverts with ParamNotFound naming the key and the entry
    }

    function test_GivenTheChainIDIsTheAvalancheMainnet() external whenLoadingTheFujiInputs {
        // it reverts with UnsupportedChain 43114
    }

    function test_GivenTheCommittedFujiParams() external whenLoadingTheFujiInputs {
        // it holds gas limits the messenger accepts and no wallet
    }

    modifier whenDeploying() {
        _;
    }

    function test_GivenLoadedInputs() external whenDeploying {
        // it deploys a hub a messenger and a broker wired to the registry facts
    }

    function test_GivenAReceiverDeployerAndNonce() external whenDeploying {
        // it gives the messenger the predicted receiver address
    }

    function test_GivenNoBrokerPairInParams() external whenDeploying {
        // it makes no allowlist call
    }

    function test_GivenABrokerPairInParams() external whenDeploying {
        // it allows the sender with the selector read from the registry
    }

    modifier whenRecordingTheDeployment() {
        _;
    }

    function test_GivenADryRun() external whenRecordingTheDeployment {
        // it writes no file
    }

    function test_GivenTheDeployedAddresses() external whenRecordingTheDeployment {
        // it serializes the chain ID the deployer and every address
    }

    modifier whenDryRunningOnAFujiFork() {
        _;
    }

    function test_GivenTheForkFlagIsSet() external whenDryRunningOnAFujiFork {
        // it deploys against the real router and USDC
    }
}
