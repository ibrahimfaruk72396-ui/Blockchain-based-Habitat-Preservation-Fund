# 🌿 Blockchain-based Habitat Preservation Fund

Welcome to an innovative Web3 solution for transparent habitat preservation! This project uses the Stacks blockchain and Clarity smart contracts to create an immutable ledger for donations, ensuring real-time verification of fund usage. Donors can contribute confidently, knowing every STX (Stacks token) or SIP-010 token is tracked, allocated, and spent transparently on real-world conservation efforts like reforestation, wildlife protection, and ecosystem restoration.

## ✨ Features

🔒 Immutable donation tracking on the blockchain  
📈 Real-time verification of fund allocation and usage  
💰 Support for STX and custom fungible tokens for donations  
🏆 Milestone-based fund releases to ensure accountability  
🗳️ Governance for community-driven project approvals  
📊 Audit trails and reports for donors and regulators  
🚫 Anti-fraud mechanisms to prevent misuse  
🌍 Integration with off-chain oracles for real-world impact verification (e.g., satellite data for habitat changes)

## 🛠 How It Works

This project tackles the real-world problem of opacity in charitable donations for environmental causes. Traditional systems often lack transparency, leading to donor distrust and potential misuse of funds. By leveraging blockchain, we provide an auditable, tamper-proof system where donors can see exactly how their contributions are used—from initial donation to on-ground implementation.

The system involves **8 smart contracts** written in Clarity, deployed on the Stacks blockchain. Here's a high-level overview:

### Core Smart Contracts

1. **DonationRegistry.clar**: Handles incoming donations in STX or tokens. Registers donors, emits events for each contribution, and stores donation metadata (e.g., amount, purpose, donor ID).  
   - Key functions: `donate-stx`, `donate-token`, `get-donation-history`.

2. **FundPool.clar**: Acts as a secure vault for pooled donations. Manages escrow-like holding of funds until allocated.  
   - Key functions: `deposit-to-pool`, `get-pool-balance`, `withdraw-for-allocation` (restricted to governance).

3. **ProjectProposal.clar**: Allows conservation organizations to submit habitat preservation projects for funding (e.g., "Reforest 100 acres in Amazon"). Includes details like budget, timelines, and milestones.  
   - Key functions: `submit-proposal`, `get-proposal-details`, `update-proposal-status`.

4. **Governance.clar**: Enables token-holding donors to vote on project approvals and fund allocations. Uses a DAO-like model for decentralized decision-making.  
   - Key functions: `vote-on-proposal`, `execute-allocation`, `get-vote-results`.

5. **MilestoneTracker.clar**: Tracks project milestones (e.g., "Trees planted verified via oracle"). Releases funds incrementally upon verification.  
   - Key functions: `submit-milestone-proof`, `verify-milestone`, `release-funds`.

6. **VerificationOracle.clar**: Integrates with external oracles (e.g., Chainlink on Stacks) to input real-world data for fund usage verification, like GPS coordinates or satellite imagery hashes.  
   - Key functions: `submit-oracle-data`, `validate-usage`, `get-verification-status`.

7. **AuditLog.clar**: Maintains an immutable log of all transactions, allocations, and verifications for real-time querying and auditing.  
   - Key functions: `log-event`, `query-audit-trail`, `generate-report`.

8. **RefundMechanism.clar**: Handles refunds for unallocated funds or failed projects, ensuring donors can reclaim contributions if milestones aren't met.  
   - Key functions: `request-refund`, `process-refund`, `get-refund-status`.

### For Donors

- Connect your Stacks wallet and call `donate-stx` or `donate-token` in the DonationRegistry contract with the amount and optional project preference.  
- Monitor your donation's journey in real-time via the AuditLog contract's `query-audit-trail`.  
- Participate in governance by voting on proposals if you hold governance tokens.

### For Project Organizers

- Submit a proposal via ProjectProposal contract, including verifiable milestones.  
- Upon approval, funds are allocated from FundPool.  
- Submit proofs to MilestoneTracker for incremental releases, verified by oracles.

### For Verifiers/Auditors

- Use AuditLog to fetch transparent reports on fund flows.  
- Call `verify-milestone` or `get-verification-status` for real-time usage checks.  

This setup ensures transparency: Every transaction is immutable, and oracles bridge on-chain data with off-chain impact. Deploy the contracts on Stacks testnet for testing, then mainnet for production. Start by cloning this repo and using the Clarity CLI to deploy!

## 🚀 Getting Started

1. Install Clarity tools: `cargo install clarity-repl`.  
2. Deploy contracts in order: DonationRegistry → FundPool → etc.  
3. Integrate with a frontend (e.g., React + Hiro Wallet) for user-friendly interactions.  
4. Test with sample donations and mock oracles.

Protect habitats transparently—let's make conservation trustworthy! 🌍