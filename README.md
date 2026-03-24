# Blockchain Voting System
### Built on Hyperledger Fabric 2.5 with CouchDB

## Project Overview

This project implements a decentralized Voting System smart contract on Hyperledger Fabric 2.5. It allows two organizations to conduct secure elections, cast votes, and declare winners on a blockchain network. CouchDB is used as the world state database enabling rich queries on voting data. The system prevents double voting, blocks votes after election closes, handles TIE scenarios, and automatically declares the winner with vote margin details.

---

## Folder Structure
```
chaincode-javascript/
├── index.js
├── package.json
├── lib/
│   └── votingSystem.js
└── META-INF/
    └── statedb/
        └── couchdb/
            └── indexes/
                └── indexVote.json
```

---

## Smart Contract Functions

| Function | Type | Description |
|----------|------|-------------|
| CreateElection | Write | Create a new election with candidates |
| GetElection | Read | Get details of an election |
| CastVote | Write | Cast a vote for a candidate |
| HasVoted | Read | Check if a voter has already voted |
| GetResults | Read | Get live vote count per candidate |
| CloseElection | Write | Close election and declare winner |
| GetWinner | Read | Get winner details after closing |
| GetAllVotes | Read | Get all votes cast in an election |
| GetAllElections | Read | List all elections on the ledger |

---

## Tech Stack

- Hyperledger Fabric 2.5
- CouchDB as world state database
- JavaScript and Node.js
- AND Endorsement Policy — Org1 + Org2

---

## How to Run

### 1. Start the network with CouchDB
```bash
cd fabric-samples/test-network
./network.sh up createChannel -ca -c mychannel -s couchdb
```

### 2. Deploy the chaincode
```bash
./network.sh deployCC -c mychannel -ccn voting-system -ccp ../voting-system/chaincode-javascript -ccl javascript
```

### 3. Set environment for Org1
```bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051
```

### 4. Set short variable
```bash
export PEER_FLAGS="-o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem -C mychannel -n voting-system --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org2.example.com/tlsca/tlsca.org2.example.com-cert.pem"
```

---

## Demo Commands

### Create election
```bash
peer chaincode invoke $PEER_FLAGS -c '{"function":"CreateElection","Args":["ELECTION1","Regional Leadership Election 2026","AlphaParty,BetaParty,GammaParty,DeltaParty"]}'
```

### Cast votes
```bash
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter001","AlphaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter002","BetaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter003","AlphaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter004","GammaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter005","DeltaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter006","AlphaParty"]}'
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter007","BetaParty"]}'
```

### Try voting twice — blocked by smart contract
```bash
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter001","BetaParty"]}'
```

Expected error:
```
Voter Voter001 has already voted. One person one vote!
```

### Get live results
```bash
peer chaincode query -C mychannel -n voting-system -c '{"Args":["GetResults","ELECTION1"]}'
```

### Close election
```bash
peer chaincode invoke $PEER_FLAGS -c '{"function":"CloseElection","Args":["ELECTION1"]}'
```

### Try voting after close — blocked
```bash
peer chaincode invoke $PEER_FLAGS -c '{"function":"CastVote","Args":["ELECTION1","Voter008","AlphaParty"]}'
```

Expected error:
```
Election ELECTION1 is closed. No more votes can be cast.
```

### Get winner
```bash
peer chaincode query -C mychannel -n voting-system -c '{"Args":["GetWinner","ELECTION1"]}'
```

### Check if voter already voted
```bash
peer chaincode query -C mychannel -n voting-system -c '{"Args":["HasVoted","ELECTION1","Voter001"]}'
```

### Get all votes
```bash
peer chaincode query -C mychannel -n voting-system -c '{"Args":["GetAllVotes","ELECTION1"]}'
```

---

## CouchDB World State

| Organization | URL | Port |
|-------------|-----|------|
| Org1 | http://localhost:5984/_utils/ | 5984 |
| Org2 | http://localhost:7984/_utils/ | 7984 |

- Login: `admin` / `adminpw`
- Database: `mychannel_voting-system`

---

## Endorsement Policy

This network uses AND Endorsement Policy which means both Org1 and Org2 must approve every transaction before it is committed to the ledger. This ensures no single organization can tamper with the election data.

---

## Sample Outputs

### GetResults
```json
{
  "electionId": "ELECTION1",
  "electionName": "Regional Leadership Election 2026",
  "status": "open",
  "results": {
    "AlphaParty": 3,
    "BetaParty": 2,
    "GammaParty": 1,
    "DeltaParty": 1
  }
}
```

### GetWinner — clear winner
```json
{
  "result": "WINNER",
  "announcement": "The elected leader is AlphaParty with 3 votes, winning by a margin of 1 votes.",
  "winner": "AlphaParty",
  "winnerVotes": 3,
  "margin": 1,
  "allResults": {
    "AlphaParty": 3,
    "BetaParty": 2,
    "GammaParty": 1,
    "DeltaParty": 1
  },
  "losers": [
    {"candidate": "BetaParty", "votes": 2, "message": "BetaParty lost by 1 vote(s) (received 2 votes)"},
    {"candidate": "GammaParty", "votes": 1, "message": "GammaParty lost by 2 vote(s) (received 1 votes)"},
    {"candidate": "DeltaParty", "votes": 1, "message": "DeltaParty lost by 2 vote(s) (received 1 votes)"}
  ],
  "totalVotes": 7
}
```

### GetWinner — TIE
```json
{
  "result": "TIE",
  "tiedCandidates": ["CandidateX", "CandidateY"],
  "tiedVotes": 1,
  "message": "It is a TIE! CandidateX and CandidateY both received 1 votes each. A re-election is required."
}
```
