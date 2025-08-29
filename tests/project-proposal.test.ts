// ProjectProposal.test.ts
import { describe, expect, it, beforeEach } from "vitest";

// Interfaces for type safety
interface ClarityResponse<T> {
  ok: boolean;
  value: T | number; // number for error codes
}

interface Milestone {
  description: string;
  budget_allocation: number;
  required_proof: string;
}

interface Proposal {
  proposer: string;
  title: string;
  description: string;
  budget: number;
  start_block: number;
  end_block: number;
  milestones: Milestone[];
  status: number;
  submission_block: number;
  tags: string[];
  metadata_hash?: string;
  vote_count_for: number;
  vote_count_against: number;
}

interface ContractState {
  proposals: Map<number, Proposal>;
  proposal_by_hash: Map<string, { proposal_id: number }>;
  next_proposal_id: number;
  admin: string;
}

// Mock contract implementation
class ProjectProposalMock {
  private state: ContractState = {
    proposals: new Map(),
    proposal_by_hash: new Map(),
    next_proposal_id: 1,
    admin: "deployer",
  };

  private ERR_UNAUTHORIZED = 100;
  private ERR_INVALID_PROPOSAL_ID = 101;
  private ERR_PROPOSAL_EXISTS = 102;
  private ERR_INVALID_BUDGET = 103;
  private ERR_INVALID_TIMELINE = 104;
  private ERR_TOO_MANY_MILESTONES = 105;
  private ERR_INVALID_STATUS = 106;
  private ERR_METADATA_TOO_LONG = 107;
  private ERR_ALREADY_FINALIZED = 108;
  private ERR_INVALID_PROPOSER = 109;
  private ERR_MAX_TAGS_EXCEEDED = 110;
  private ERR_INVALID_TAG = 111;

  private STATUS_PENDING = 0;
  private STATUS_APPROVED = 1;
  private STATUS_REJECTED = 2;
  private STATUS_ONGOING = 3;
  private STATUS_COMPLETED = 4;
  private STATUS_CANCELLED = 5;

  private MAX_MILESTONES = 10;
  private MAX_METADATA_LEN = 1000;
  private MAX_TAGS = 5;
  private MAX_TAG_LEN = 50;

  private computeProposalHash(title: string, description: string, budget: number, milestones: Milestone[]): string {
    // Simplified hash computation for testing
    return `${title}-${description}-${budget}-${milestones.map(m => m.description).join('-')}`;
  }

  private validateMilestones(milestones: Milestone[]): boolean {
    return milestones.length <= this.MAX_MILESTONES && milestones.reduce((sum, m) => sum + m.budget_allocation, 0) > 0;
  }

  private validateTags(tags: string[]): boolean {
    return tags.length <= this.MAX_TAGS && tags.every(tag => tag.length <= this.MAX_TAG_LEN);
  }

  submitProposal(
    caller: string,
    title: string,
    description: string,
    budget: number,
    start_block: number,
    end_block: number,
    milestones: Milestone[],
    tags: string[],
    metadata_hash?: string
  ): ClarityResponse<number> {
    const proposal_hash = this.computeProposalHash(title, description, budget, milestones);
    if (this.state.proposal_by_hash.has(proposal_hash)) {
      return { ok: false, value: this.ERR_PROPOSAL_EXISTS };
    }
    if (budget <= 0) {
      return { ok: false, value: this.ERR_INVALID_BUDGET };
    }
    if (start_block >= end_block) {
      return { ok: false, value: this.ERR_INVALID_TIMELINE };
    }
    if (!this.validateMilestones(milestones)) {
      return { ok: false, value: this.ERR_TOO_MANY_MILESTONES };
    }
    if (description.length > this.MAX_METADATA_LEN) {
      return { ok: false, value: this.ERR_METADATA_TOO_LONG };
    }
    if (!this.validateTags(tags)) {
      return { ok: false, value: this.ERR_MAX_TAGS_EXCEEDED };
    }
    if (caller === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: this.ERR_INVALID_PROPOSER };
    }
    const id = this.state.next_proposal_id;
    this.state.proposals.set(id, {
      proposer: caller,
      title,
      description,
      budget,
      start_block,
      end_block,
      milestones,
      status: this.STATUS_PENDING,
      submission_block: 100, // Mock block
      tags,
      metadata_hash,
      vote_count_for: 0,
      vote_count_against: 0,
    });
    this.state.proposal_by_hash.set(proposal_hash, { proposal_id: id });
    this.state.next_proposal_id += 1;
    return { ok: true, value: id };
  }

  updateProposalStatus(caller: string, proposal_id: number, new_status: number): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    const proposal = this.state.proposals.get(proposal_id);
    if (!proposal) {
      return { ok: false, value: this.ERR_INVALID_PROPOSAL_ID };
    }
    if (proposal.status === this.STATUS_COMPLETED) {
      return { ok: false, value: this.ERR_ALREADY_FINALIZED };
    }
    const validStatuses = [this.STATUS_APPROVED, this.STATUS_REJECTED, this.STATUS_ONGOING, this.STATUS_COMPLETED, this.STATUS_CANCELLED];
    if (!validStatuses.includes(new_status)) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    proposal.status = new_status;
    this.state.proposals.set(proposal_id, proposal);
    return { ok: true, value: true };
  }

  addVote(caller: string, proposal_id: number, vote_for: boolean): ClarityResponse<boolean> {
    const proposal = this.state.proposals.get(proposal_id);
    if (!proposal) {
      return { ok: false, value: this.ERR_INVALID_PROPOSAL_ID };
    }
    if (proposal.status !== this.STATUS_PENDING) {
      return { ok: false, value: this.ERR_INVALID_STATUS };
    }
    if (caller === proposal.proposer) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (vote_for) {
      proposal.vote_count_for += 1;
    } else {
      proposal.vote_count_against += 1;
    }
    this.state.proposals.set(proposal_id, proposal);
    return { ok: true, value: true };
  }

  updateMetadata(caller: string, proposal_id: number, new_metadata_hash: string): ClarityResponse<boolean> {
    const proposal = this.state.proposals.get(proposal_id);
    if (!proposal) {
      return { ok: false, value: this.ERR_INVALID_PROPOSAL_ID };
    }
    if (caller !== proposal.proposer) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    if (proposal.status !== this.STATUS_PENDING) {
      return { ok: false, value: this.ERR_ALREADY_FINALIZED };
    }
    proposal.metadata_hash = new_metadata_hash;
    this.state.proposals.set(proposal_id, proposal);
    return { ok: true, value: true };
  }

  getProposalDetails(proposal_id: number): ClarityResponse<Proposal | null> {
    return { ok: true, value: this.state.proposals.get(proposal_id) ?? null };
  }

  getNextProposalId(): ClarityResponse<number> {
    return { ok: true, value: this.state.next_proposal_id };
  }

  getProposalByHash(hash: string): ClarityResponse<Proposal | null> {
    const id = this.state.proposal_by_hash.get(hash)?.proposal_id;
    if (id === undefined) {
      return { ok: true, value: null };
    }
    return this.getProposalDetails(id);
  }

  getProposalStatus(proposal_id: number): ClarityResponse<number> {
    const proposal = this.state.proposals.get(proposal_id);
    if (!proposal) {
      return { ok: false, value: this.ERR_INVALID_PROPOSAL_ID };
    }
    return { ok: true, value: proposal.status };
  }

  getVoteCounts(proposal_id: number): ClarityResponse<{ for: number; against: number }> {
    const proposal = this.state.proposals.get(proposal_id);
    if (!proposal) {
      return { ok: false, value: this.ERR_INVALID_PROPOSAL_ID };
    }
    return { ok: true, value: { for: proposal.vote_count_for, against: proposal.vote_count_against } };
  }

  isProposalActive(proposal_id: number): boolean {
    const status = this.getProposalStatus(proposal_id).value as number;
    return [this.STATUS_PENDING, this.STATUS_APPROVED, this.STATUS_ONGOING].includes(status);
  }

  setAdmin(caller: string, new_admin: string): ClarityResponse<boolean> {
    if (caller !== this.state.admin) {
      return { ok: false, value: this.ERR_UNAUTHORIZED };
    }
    this.state.admin = new_admin;
    return { ok: true, value: true };
  }
}

// Test setup
const accounts = {
  deployer: "deployer",
  proposer: "wallet_1",
  voter: "wallet_2",
  invalid: "SP000000000000000000002Q6VF78",
};

describe("ProjectProposal Contract", () => {
  let contract: ProjectProposalMock;

  beforeEach(() => {
    contract = new ProjectProposalMock();
  });

  it("should allow valid proposal submission", () => {
    const milestones: Milestone[] = [
      { description: "Plant 100 trees", budget_allocation: 500, required_proof: "GPS coords" },
    ];
    const tags = ["reforestation"];
    const result = contract.submitProposal(
      accounts.proposer,
      "Reforest Area X",
      "Detailed plan to reforest 100 acres.",
      1000,
      100,
      200,
      milestones,
      tags
    );
    expect(result).toEqual({ ok: true, value: 1 });

    const details = contract.getProposalDetails(1);
    expect(details.value).toMatchObject({
      title: "Reforest Area X",
      budget: 1000,
      status: 0,
    });
  });

  it("should prevent duplicate proposals via hash", () => {
    const milestones: Milestone[] = [
      { description: "Plant 100 trees", budget_allocation: 500, required_proof: "GPS coords" },
    ];
    const tags = ["reforestation"];
    contract.submitProposal(
      accounts.proposer,
      "Reforest Area X",
      "Detailed plan to reforest 100 acres.",
      1000,
      100,
      200,
      milestones,
      tags
    );

    const duplicate = contract.submitProposal(
      accounts.proposer,
      "Reforest Area X",
      "Detailed plan to reforest 100 acres.",
      1000,
      100,
      200,
      milestones,
      tags
    );
    expect(duplicate).toEqual({ ok: false, value: 102 });
  });

  it("should prevent invalid budget", () => {
    const result = contract.submitProposal(
      accounts.proposer,
      "Invalid",
      "Desc",
      0,
      100,
      200,
      [],
      []
    );
    expect(result).toEqual({ ok: false, value: 103 });
  });

  it("should allow admin to update status", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );

    const update = contract.updateProposalStatus(accounts.deployer, 1, 1); // APPROVED
    expect(update).toEqual({ ok: true, value: true });

    const status = contract.getProposalStatus(1);
    expect(status).toEqual({ ok: true, value: 1 });
  });

  it("should prevent non-admin from updating status", () => {
    const update = contract.updateProposalStatus(accounts.proposer, 1, 1);
    expect(update).toEqual({ ok: false, value: 100 });
  });

  it("should allow voting on pending proposal", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );

    const vote = contract.addVote(accounts.voter, 1, true);
    expect(vote).toEqual({ ok: true, value: true });

    const counts = contract.getVoteCounts(1);
    expect(counts.value).toEqual({ for: 1, against: 0 });
  });

  it("should prevent proposer from voting", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );

    const vote = contract.addVote(accounts.proposer, 1, true);
    expect(vote).toEqual({ ok: false, value: 100 });
  });

  it("should allow proposer to update metadata on pending proposal", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );

    const update = contract.updateMetadata(accounts.proposer, 1, "newhash");
    expect(update).toEqual({ ok: true, value: true });

    const details = contract.getProposalDetails(1);
    expect(details.value?.metadata_hash).toBe("newhash");
  });

  it("should prevent metadata update on non-pending proposal", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );
    contract.updateProposalStatus(accounts.deployer, 1, 1); // APPROVED

    const update = contract.updateMetadata(accounts.proposer, 1, "newhash");
    expect(update).toEqual({ ok: false, value: 108 });
  });

  it("should return correct next proposal ID", () => {
    expect(contract.getNextProposalId()).toEqual({ ok: true, value: 1 });
  });

  it("should check if proposal is active", () => {
    contract.submitProposal(
      accounts.proposer,
      "Test",
      "Desc",
      1000,
      100,
      200,
      [{ description: "Milestone", budget_allocation: 500, required_proof: "Proof" }],
      []
    );
    expect(contract.isProposalActive(1)).toBe(true);

    contract.updateProposalStatus(accounts.deployer, 1, 4); // COMPLETED
    expect(contract.isProposalActive(1)).toBe(false);
  });

  it("should allow admin to set new admin", () => {
    const setAdmin = contract.setAdmin(accounts.deployer, accounts.proposer);
    expect(setAdmin).toEqual({ ok: true, value: true });
  });

  it("should prevent non-admin from setting admin", () => {
    const setAdmin = contract.setAdmin(accounts.proposer, accounts.voter);
    expect(setAdmin).toEqual({ ok: false, value: 100 });
  });

  it("should prevent too many milestones", () => {
    const tooManyMilestones = Array(11).fill({ description: "M", budget_allocation: 1, required_proof: "P" });
    const result = contract.submitProposal(
      accounts.proposer,
      "Too Many",
      "Desc",
      1000,
      100,
      200,
      tooManyMilestones,
      []
    );
    expect(result).toEqual({ ok: false, value: 105 });
  });

  it("should prevent invalid tags", () => {
    const invalidTags = ["a".repeat(51)];
    const result = contract.submitProposal(
      accounts.proposer,
      "Invalid Tags",
      "Desc",
      1000,
      100,
      200,
      [{ description: "M", budget_allocation: 500, required_proof: "P" }],
      invalidTags
    );
    expect(result).toEqual({ ok: false, value: 110 });
  });
});