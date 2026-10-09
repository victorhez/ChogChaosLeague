// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChaosLedger} from "../src/ChaosLedger.sol";

contract ChaosLedgerTest is Test {
    ChaosLedger ledger;
    address owner = address(0xA11CE);

    // Two-leaf tree built in-test; mirrors lib/merkle.ts (sorted-pair hashing).
    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a <= b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function setUp() public {
        ledger = new ChaosLedger(owner);
    }

    function test_anchorAndVerifyTwoLeaves() public {
        bytes32 l1 = ledger.leafOf(3, 1, 120, 9, 4, 5);
        bytes32 l2 = ledger.leafOf(3, 2, 95, 7, 6, 3);
        bytes32 root = _pair(l1, l2);

        vm.prank(owner);
        ledger.anchorSeason(3, root, 168);

        bytes32[] memory p1 = new bytes32[](1);
        p1[0] = l2;
        bytes32[] memory p2 = new bytes32[](1);
        p2[0] = l1;
        assertTrue(ledger.verify(3, 1, 120, 9, 4, 5, p1));
        assertTrue(ledger.verify(3, 2, 95, 7, 6, 3, p2));
        assertEq(ledger.roundCounts(3), 168);
    }

    function test_tamperedRecordFails() public {
        bytes32 l1 = ledger.leafOf(3, 1, 120, 9, 4, 5);
        bytes32 l2 = ledger.leafOf(3, 2, 95, 7, 6, 3);
        vm.prank(owner);
        ledger.anchorSeason(3, _pair(l1, l2), 168);
        bytes32[] memory p = new bytes32[](1);
        p[0] = l2;
        assertFalse(ledger.verify(3, 1, 999, 9, 4, 5, p));
    }

    function test_unanchoredSeasonNeverVerifies() public view {
        bytes32[] memory p = new bytes32[](0);
        assertFalse(ledger.verify(9, 1, 1, 1, 1, 1, p));
    }

    function test_onlyOwnerAnchors() public {
        vm.expectRevert(ChaosLedger.NotOwner.selector);
        ledger.anchorSeason(1, bytes32(uint256(1)), 168);
    }

    function test_seasonAnchoredOnce() public {
        vm.startPrank(owner);
        ledger.anchorSeason(1, bytes32(uint256(1)), 168);
        vm.expectRevert(ChaosLedger.AlreadyAnchored.selector);
        ledger.anchorSeason(1, bytes32(uint256(2)), 168);
        vm.stopPrank();
    }

    function test_emptyRootRejected() public {
        vm.prank(owner);
        vm.expectRevert(ChaosLedger.EmptyRoot.selector);
        ledger.anchorSeason(1, bytes32(0), 168);
    }

    function test_singleLeafTreeIsItsOwnRoot() public {
        bytes32 l = ledger.leafOf(0, 7, 10, 1, 0, 1);
        vm.prank(owner);
        ledger.anchorSeason(0, l, 1);
        bytes32[] memory p = new bytes32[](0);
        assertTrue(ledger.verify(0, 7, 10, 1, 0, 1, p));
    }
}
