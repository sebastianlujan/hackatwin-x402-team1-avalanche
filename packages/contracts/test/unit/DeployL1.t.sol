// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitDeployL1 {
    modifier whenLoadingTheL1Inputs() {
        _;
    }

    function test_GivenTheRealRegistryThatHasNoL1ChainIDYet() external whenLoadingTheL1Inputs {
        // it reverts with EntryNotFound naming the L1 key and chainId
    }

    function test_GivenFixturesWithEveryFactAndParameter() external whenLoadingTheL1Inputs {
        // it resolves facts from the registry and choices from params and the Fuji record
    }

    function test_GivenTheChainIDIsTheAvalancheMainnet() external whenLoadingTheL1Inputs {
        // it reverts with UnsupportedChain 43114
    }

    function test_GivenNoFujiRecord() external whenLoadingTheL1Inputs {
        // it reverts with ParamNotFound naming the record
    }

    modifier whenDeployingTheReceiver() {
        _;
    }

    function test_GivenTheFujiDeployResultAndFixtureInputs() external whenDeployingTheReceiver {
        // it deploys a receiver at the predicted address wired to the messenger
    }

    function test_GivenAReceiverDeployerNonceThatMoved() external whenDeployingTheReceiver {
        // it reverts with NonceMismatch before any deployment
    }

    function test_GivenAFujiRecordWithAnotherPredictedReceiver() external whenDeployingTheReceiver {
        // it reverts with AddressMismatch before any deployment
    }

    function test_GivenNoMerchantInParams() external whenDeployingTheReceiver {
        // it makes no allowlist call
    }

    function test_GivenMerchantsInParams() external whenDeployingTheReceiver {
        // it allows each merchant on the receiver
    }

    modifier whenRecordingTheDeployment() {
        _;
    }

    function test_GivenADryRun() external whenRecordingTheDeployment {
        // it writes no file
    }

    function test_GivenTheDeployedReceiver() external whenRecordingTheDeployment {
        // it serializes the chain ID the deployer and the receiver
    }
}
