// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.24;

import {IProofVerifier} from "../../proof/interfaces/IProofVerifier.sol";

contract ProofVerifierMock is IProofVerifier {
    error UnexpectedSignature(bytes32 proofSignature, bytes32 paramSignature);
    error UnexpectedHash(bytes32 proofHash, bytes32 paramHash);
    error UnexpectedChain(uint256 proofChain, uint256 paramChain);

    uint256 public verifiedProofCount;

    function verifyHashEventProof(bytes32 sig_, bytes32 hash_, uint256 chain_, bytes calldata proof_) external {
        (bytes32 proofSig, bytes32 proofHash, uint256 proofChain) = abi.decode(proof_, (bytes32, bytes32, uint256));
        if (proofSig != sig_) revert UnexpectedSignature(proofSig, sig_);
        if (proofHash != hash_) revert UnexpectedHash(proofHash, hash_);
        if (proofChain != chain_) revert UnexpectedChain(proofChain, chain_);
        verifiedProofCount++;
    }
}
