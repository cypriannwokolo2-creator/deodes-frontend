import { get, post } from "@/lib/api-client"

export type ProposalStatus = "active" | "passed" | "defeated" | "draft" | "all"

/**
 * Minimum total votes (For + Against + Abstain) for a proposal to reach quorum.
 *
 * Sourced from the on-chain governance contract; surfaced in the UI so voters
 * can see how close a proposal is to being valid for consideration.
 */
export const QUORUM_THRESHOLD_VOTES = 1_000

export interface GovernanceProposal {
  id: string
  title: string
  description: string
  status: ProposalStatus
  category?: string
  votesFor: number
  votesAgainst: number
  votesAbstain?: number
  timelockEndsAt: string | null
  createdAt?: string
  proposer?: string
  executionPayload?: string
}

interface BackendProposal {
  id: string
  title: string
  description: string
  proposalType?: string
  creatorId?: string
  status: string
  forVotes?: number
  againstVotes?: number
  executableAt?: string | null
  createdAt?: string
}

function toFrontend(p: BackendProposal): GovernanceProposal {
  const statusMap: Record<string, ProposalStatus> = {
    pending: "active",
    active: "active",
    passed: "passed",
    executed: "passed",
    rejected: "defeated",
    defeated: "defeated",
    cancelled: "defeated",
  }
  return {
    id: String(p.id),
    title: p.title,
    description: p.description,
    status: statusMap[p.status] ?? "active",
    category: p.proposalType,
    votesFor: p.forVotes ?? 0,
    votesAgainst: p.againstVotes ?? 0,
    timelockEndsAt: p.executableAt ?? null,
    createdAt: p.createdAt,
    proposer: p.creatorId,
  }
}

export const MOCK_GOVERNANCE_PROPOSALS: GovernanceProposal[] = [
  {
    id: "prop_101",
    title: "MIP-14: Lower Circle Collateral Requirement to 5%",
    description: "Proposal to adjust the default collateral percent from 10% down to 5% for High-Reputation (DeoScore 750+) organizers to improve capital efficiency.",
    status: "active",
    category: "Circle Parameter",
    votesFor: 1420,
    votesAgainst: 180,
    votesAbstain: 45,
    timelockEndsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
    createdAt: "2024-05-10",
    proposer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    executionPayload: JSON.stringify({ target: "CircleFactory", action: "updateMinCollateralBps", value: 500 }, null, 2),
  },
  {
    id: "prop_102",
    title: "MIP-15: Allocate 50,000 USDC from Community Treasury for Developer Grants",
    description: "Direct community treasury funds towards building automated Arc dispute resolution bots and notifications.",
    status: "active",
    category: "Treasury Release",
    votesFor: 980,
    votesAgainst: 420,
    votesAbstain: 110,
    timelockEndsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    createdAt: "2024-05-12",
    proposer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    executionPayload: JSON.stringify({ target: "Treasury", action: "disburseGrant", amount: 50000, recipient: "0x1111111111111111111111111111111111111111" }, null, 2),
  },
  {
    id: "prop_103",
    title: "MIP-12: Integrate Automated Inflation Protection for USDC Pools",
    description: "Approved proposal implementing automatic yield routing for idle circle reserves into Arc liquidity pools.",
    status: "passed",
    category: "Rule Amendment",
    votesFor: 2840,
    votesAgainst: 310,
    votesAbstain: 90,
    timelockEndsAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    createdAt: "2024-04-20",
    proposer: "0x2222222222222222222222222222222222222222",
    executionPayload: JSON.stringify({ target: "Staking", action: "enableYieldRouting", enabled: true }, null, 2),
  },
  {
    id: "prop_104",
    title: "MIP-11: Increase Max Member Limit per Circle to 50",
    description: "Defeated proposal that sought to raise circle capacity limit from 30 to 50 members.",
    status: "defeated",
    category: "Circle Parameter",
    votesFor: 450,
    votesAgainst: 1890,
    votesAbstain: 210,
    timelockEndsAt: null,
    createdAt: "2024-04-01",
    proposer: "0x3333333333333333333333333333333333333333",
  },
]

export async function listProposals(status: ProposalStatus = "all", search = "") {
  try {
    const params = new URLSearchParams()
    if (status !== "all") params.set("status", status)
    const q = search.trim()
    if (q) params.set("search", q)
    const qs = params.toString()
    const result = await get<{ proposals?: BackendProposal[] } | BackendProposal[]>(
      `/governance/proposals${qs ? `?${qs}` : ""}`,
    )
    const list = Array.isArray(result) ? result : result.proposals ?? []
    if (list.length > 0) return list.map(toFrontend)
  } catch {
    // API mock fallback
  }

  if (status === "all") return MOCK_GOVERNANCE_PROPOSALS
  return MOCK_GOVERNANCE_PROPOSALS.filter((p) => p.status === status)
}

export async function getProposal(id: string) {
  try {
    const result = await get<{ proposal?: BackendProposal } | BackendProposal>(
      `/governance/proposals/${id}`,
    )
    const p = "proposal" in result && result.proposal ? result.proposal : (result as BackendProposal)
    if (p && p.id) return toFrontend(p)
  } catch {
    // API mock fallback
  }

  return MOCK_GOVERNANCE_PROPOSALS.find((p) => p.id === id) || MOCK_GOVERNANCE_PROPOSALS[0]
}

export async function createProposal(input: {
  title: string
  description: string
  executionPayload: string
  category?: string
}): Promise<GovernanceProposal> {
  const result = await post<{ proposal?: BackendProposal } | BackendProposal>(
    "/governance/proposals",
    {
      title: input.title.trim(),
      description: input.description.trim(),
      proposalType: input.category || "Rule Amendment",
    },
  )
  const p = "proposal" in result && result.proposal ? result.proposal : (result as BackendProposal)
  if (!p || !p.id) throw new Error("Proposal creation failed. Please try again.")
  return toFrontend(p)
}

export type VoteChoice = "for" | "against" | "abstain"

/** Path a vote is submitted to, relative to the API base. */
export const VOTE_PATH = (id: string) => `/governance/proposals/${id}/vote`

/**
 * Cast a vote on a proposal.
 *
 * Previously this only mutated the in-memory `MOCK_GOVERNANCE_PROPOSALS` array
 * and resolved — no request was ever made, so a "vote" existed only until the
 * page reloaded. `src/hooks/__tests__/use-governance.test.ts` has been
 * asserting a real `POST` this whole time, and failing.
 *
 * The mock tally is retained only for a **2xx response with no proposal body**,
 * which still means the vote landed and the local figure is the best available
 * answer. Errors are deliberately **not** swallowed.
 *
 * That distinction matters: an earlier version wrapped the request in a
 * `try/catch` that fell through to the mock on failure, so a vote rejected by
 * the signer returned `{ success: true }`, the optimistic update never rolled
 * back, and the user was shown a tally that had not moved. A read can fall back
 * to a mock because a stale list is merely unhelpful; a write cannot, because
 * the fallback reports a mutation that never happened.
 */
export async function voteOnProposal(
  id: string,
  support: boolean | VoteChoice,
  _reason?: string,
): Promise<{ success: boolean; proposal: GovernanceProposal | undefined }> {
  // The hook historically passed a boolean while the store and UI speak a
  // three-way choice, so normalise at the boundary rather than forwarding the
  // mixed `boolean | "abstain"` union.
  const choice: VoteChoice =
    support === true ? "for" : support === false ? "against" : "abstain"

  // The chain records for/against only — abstention is a valid UI position
  // but has no on-chain expression, so it is refused loudly rather than
  // misrecorded as a vote against.
  if (choice === "abstain") {
    throw new Error("Abstentions are not recorded on-chain yet — vote for or against.")
  }

  const result = await post<{ proposal?: GovernanceProposal } | GovernanceProposal>(
    VOTE_PATH(id),
    { vote: choice === "for" },
  )

  const returned =
    result && typeof result === "object" && "proposal" in result
      ? (result as { proposal?: GovernanceProposal }).proposal
      : (result as GovernanceProposal | undefined)
  if (returned?.id) return { success: true, proposal: returned }

  // Accepted, but the response carried nothing usable. Apply the local tally so
  // the UI is not left showing a pre-vote number.
  const prop = MOCK_GOVERNANCE_PROPOSALS.find((p) => p.id === id)
  if (prop) {
    if (choice === "for") prop.votesFor += 1
    else if (choice === "against") prop.votesAgainst += 1
    else prop.votesAbstain = (prop.votesAbstain || 0) + 1
  }
  return { success: true, proposal: prop }
}
