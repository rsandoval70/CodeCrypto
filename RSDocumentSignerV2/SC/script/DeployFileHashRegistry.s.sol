// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/FileHashRegistry.sol";

contract DeployFileHashRegistry is Script {
    function run() external returns (FileHashRegistry deployed) {
        vm.startBroadcast();
        deployed = new FileHashRegistry();
        vm.stopBroadcast();
    }
}
