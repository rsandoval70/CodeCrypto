// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract FileHashRegistry {
    struct FileRecord {
        bytes32 fileHash;
        uint256 fileDate;
        address authorizer;
        bytes signature;
        uint256 storedAt;
        address storedBy;
    }

    mapping(bytes32 => FileRecord) private records;
    mapping(bytes32 => bool) private registered;
    bytes32[] private fileHashes;

    event FileRegistered(
        bytes32 indexed fileHash,
        uint256 indexed fileDate,
        address indexed authorizer,
        address storedBy
    );

    error InvalidFileHash();
    error FileAlreadyRegistered(bytes32 fileHash);
    error InvalidSignature();
    error InvalidSignatureLength();
    error FileNotRegistered(bytes32 fileHash);

    function registerFile(
        bytes32 fileHash,
        uint256 fileDate,
        address authorizer,
        bytes calldata signature
    ) external {
        if (fileHash == bytes32(0)) revert InvalidFileHash();
        if (registered[fileHash]) revert FileAlreadyRegistered(fileHash);

        if (!_isValidSignature(fileHash, fileDate, authorizer, signature)) {
            revert InvalidSignature();
        }

        records[fileHash] = FileRecord({
            fileHash: fileHash,
            fileDate: fileDate,
            authorizer: authorizer,
            signature: signature,
            storedAt: block.timestamp,
            storedBy: msg.sender
        });

        registered[fileHash] = true;
        fileHashes.push(fileHash);

        emit FileRegistered(fileHash, fileDate, authorizer, msg.sender);
    }

    function isFileRegistered(bytes32 fileHash) external view returns (bool) {
        return registered[fileHash];
    }

    function validateFileHash(bytes32 fileHash) external view returns (bool) {
        return registered[fileHash] && records[fileHash].fileHash == fileHash;
    }

    function validateAuthorizedAccount(bytes32 fileHash, address account) external view returns (bool) {
        return registered[fileHash] && records[fileHash].authorizer == account;
    }

    function validateRegistration(bytes32 fileHash, address account) external view returns (bool) {
        return registered[fileHash]
            && records[fileHash].fileHash == fileHash
            && records[fileHash].authorizer == account;
    }

    function getFileRecord(bytes32 fileHash) external view returns (FileRecord memory) {
        if (!registered[fileHash]) revert FileNotRegistered(fileHash);
        return records[fileHash];
    }

    function getAllSignedFiles() external view returns (FileRecord[] memory) {
        uint256 length = fileHashes.length;
        FileRecord[] memory allFiles = new FileRecord[](length);

        for (uint256 i = 0; i < length; i++) {
            allFiles[i] = records[fileHashes[i]];
        }

        return allFiles;
    }

    function getFileHashes() external view returns (bytes32[] memory) {
        return fileHashes;
    }

    function totalFiles() external view returns (uint256) {
        return fileHashes.length;
    }

    function verifySignature(
        bytes32 fileHash,
        uint256 fileDate,
        address authorizer,
        bytes calldata signature
    ) external pure returns (bool) {
        return _isValidSignature(fileHash, fileDate, authorizer, signature);
    }

    function _isValidSignature(
        bytes32 fileHash,
        uint256 fileDate,
        address authorizer,
        bytes calldata signature
    ) internal pure returns (bool) {
        bytes32 messageHash = keccak256(abi.encodePacked(fileHash, fileDate));
        bytes32 digest = _toEthSignedMessageHash(messageHash);
        address recoveredSigner = _recoverSigner(digest, signature);
        return recoveredSigner == authorizer;
    }

    function _toEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
    }

    function _recoverSigner(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 0x20))
            v := byte(0, calldataload(add(signature.offset, 0x40)))
        }

        if (v < 27) {
            v += 27;
        }
        if (v != 27 && v != 28) {
            return address(0);
        }

        return ecrecover(digest, v, r, s);
    }
}
