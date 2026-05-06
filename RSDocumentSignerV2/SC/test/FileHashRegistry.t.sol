// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/FileHashRegistry.sol";

contract FileHashRegistryTest is Test {
    FileHashRegistry private registry;

    uint256 private authorizerPk = 0xA11CE;
    address private authorizer;

    function setUp() public {
        registry = new FileHashRegistry();
        authorizer = vm.addr(authorizerPk);
    }

    function testRegisterFileAndReadBack() public {
        bytes32 fileHash = keccak256("archivo-1");
        uint256 fileDate = 1_715_000_000;
        bytes memory signature = _sign(fileHash, fileDate, authorizerPk);

        registry.registerFile(fileHash, fileDate, authorizer, signature);

        assertTrue(registry.isFileRegistered(fileHash));
        assertTrue(registry.validateFileHash(fileHash));
        assertTrue(registry.validateAuthorizedAccount(fileHash, authorizer));
        assertEq(registry.totalFiles(), 1);

        FileHashRegistry.FileRecord memory record = registry.getFileRecord(fileHash);
        assertEq(record.fileHash, fileHash);
        assertEq(record.fileDate, fileDate);
        assertEq(record.authorizer, authorizer);
        assertEq(record.signature, signature);
    }

    function testCannotRegisterSameHashTwice() public {
        bytes32 fileHash = keccak256("archivo-duplicado");
        uint256 fileDate = 1_715_000_001;
        bytes memory signature = _sign(fileHash, fileDate, authorizerPk);

        registry.registerFile(fileHash, fileDate, authorizer, signature);

        vm.expectRevert();
        registry.registerFile(fileHash, fileDate, authorizer, signature);
    }

    function testRejectsInvalidSignature() public {
        bytes32 fileHash = keccak256("archivo-firma-invalida");
        uint256 fileDate = 1_715_000_002;
        bytes memory signature = _sign(fileHash, fileDate, 0xB0B);

        vm.expectRevert(FileHashRegistry.InvalidSignature.selector);
        registry.registerFile(fileHash, fileDate, authorizer, signature);
    }

    function testGetAllSignedFiles() public {
        bytes32 fileHashA = keccak256("archivo-a");
        bytes32 fileHashB = keccak256("archivo-b");
        uint256 fileDateA = 1_715_000_010;
        uint256 fileDateB = 1_715_000_011;

        registry.registerFile(fileHashA, fileDateA, authorizer, _sign(fileHashA, fileDateA, authorizerPk));
        registry.registerFile(fileHashB, fileDateB, authorizer, _sign(fileHashB, fileDateB, authorizerPk));

        FileHashRegistry.FileRecord[] memory files = registry.getAllSignedFiles();
        assertEq(files.length, 2);
        assertEq(files[0].fileHash, fileHashA);
        assertEq(files[1].fileHash, fileHashB);
    }

    function _sign(bytes32 fileHash, uint256 fileDate, uint256 privateKey)
        internal
        returns (bytes memory)
    {
        bytes32 messageHash = keccak256(abi.encodePacked(fileHash, fileDate));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
