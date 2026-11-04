// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

contract UnitDeploy {
    modifier whenCheckingTheChain() {
        _;
    }

    function test_GivenTheChainIDMatchesTheRegistryChainIDOfTheKey() external whenCheckingTheChain {
        // it passes
    }

    function test_GivenTheChainIDIsAnotherRegisteredChain() external whenCheckingTheChain {
        // it reverts with UnsupportedChain naming the chain ID
    }

    function test_GivenTheChainIDIsTheAvalancheMainnet() external whenCheckingTheChain {
        // it reverts with UnsupportedChain 43114
    }

    modifier whenReadingParameters() {
        _;
    }

    function test_GivenAParamsFileWithTheEntry() external whenReadingParameters {
        // it returns the address and the number
    }

    function test_GivenAParamsFileWithoutTheEntry() external whenReadingParameters {
        // it reverts with ParamNotFound naming the key and the entry
    }

    function test_GivenNoParamsFile() external whenReadingParameters {
        // it reverts with ParamNotFound naming the file
    }

    modifier whenWritingTheDeploymentRecord() {
        _;
    }

    function test_GivenAContextThatIsNotABroadcast() external whenWritingTheDeploymentRecord {
        // it writes no file
    }

    function test_GivenTheProjectFilePermissions() external whenWritingTheDeploymentRecord {
        // it grants write only to the deployments directory
    }
}
