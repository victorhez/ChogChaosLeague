// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ChaosLedger} from "../src/ChaosLedger.sol";

/// forge script script/Deploy.s.sol --rpc-url https://rpc.monad.xyz --broadcast --private-key $PRIVATE_KEY
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        ChaosLedger ledger = new ChaosLedger(msg.sender);
        vm.stopBroadcast();
        console2.log("ChaosLedger:", address(ledger));
    }
}
