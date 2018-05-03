pragma solidity ^0.4.18;

contract Zlto {
    function Zlto() public {
        owner = msg.sender;
    }
    
    event ProofCreated(
        uint256 indexed id,
        bytes32 documentHash
    );

    address public owner;
  
    mapping (uint256 => bytes32) public hashesById;

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    modifier noHashExistsYet(uint256 id) {
        require(hashesById[id] == "");
        _;
    }

    function ProofOfExistence() public {
        owner = msg.sender;
    }

    function notarizeHash(uint256 id, bytes32 documentHash) onlyOwner public returns(bool){
        hashesById[id] = documentHash;

        ProofCreated(id, documentHash);
        
        return true;
    }

    function doesProofExist(uint256 id, bytes32 documentHash) public view returns (bool) {
        return hashesById[id] == documentHash;
    }
}