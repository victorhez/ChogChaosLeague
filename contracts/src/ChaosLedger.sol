// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChaosLedger
/// @notice Anchors one Merkle root per Chog Chaos League season. Holds no NFTs and no funds.
/// @dev Leaves are keccak256(abi.encodePacked(seasonId, tokenId, points, wins, losses, bestStreak)),
///      all uint256. Pairs are hashed in sorted order (same convention as OpenZeppelin MerkleProof),
///      so any client can rebuild and check a proof with plain keccak256.
contract ChaosLedger {
    address public owner;
    mapping(uint256 => bytes32) public roots;
    mapping(uint256 => uint256) public roundCounts;

    event SeasonAnchored(uint256 indexed seasonId, bytes32 root, uint256 rounds);
    event OwnershipTransferred(address indexed from, address indexed to);

    error NotOwner();
    error AlreadyAnchored();
    error EmptyRoot();
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    /// @notice Write a season root. A season can be anchored exactly once.
    function anchorSeason(uint256 seasonId, bytes32 root, uint256 rounds) external onlyOwner {
        if (root == bytes32(0)) revert EmptyRoot();
        if (roots[seasonId] != bytes32(0)) revert AlreadyAnchored();
        roots[seasonId] = root;
        roundCounts[seasonId] = rounds;
        emit SeasonAnchored(seasonId, root, rounds);
    }

    function leafOf(
        uint256 seasonId,
        uint256 tokenId,
        uint256 points,
        uint256 wins,
        uint256 losses,
        uint256 bestStreak
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(seasonId, tokenId, points, wins, losses, bestStreak));
    }

    /// @notice True when the record for `tokenId` is part of the anchored season root.
    function verify(
        uint256 seasonId,
        uint256 tokenId,
        uint256 points,
        uint256 wins,
        uint256 losses,
        uint256 bestStreak,
        bytes32[] calldata proof
    ) external view returns (bool) {
        bytes32 root = roots[seasonId];
        if (root == bytes32(0)) return false;
        bytes32 h = leafOf(seasonId, tokenId, points, wins, losses, bestStreak);
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h <= p ? keccak256(abi.encodePacked(h, p)) : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }
}
