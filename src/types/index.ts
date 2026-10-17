/* ───── Enums / Literal Unions ───── */

export type CircleStatus =
  | "pending"
  | "active"
  | "completed"
  | "cancelled"
  | "disputed"

export type CircleType = "public" | "private" | "community" | "premium"

export type PayoutType = "random" | "fixed" | "auction" | "vote"

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly"

/** Arc USDC is the only supported currency. */
export type Currency = "USDC"

export type MemberStatus =
  | "invited"
  | "pending"
  | "active"
  | "defaulter"
  | "left"
  | "removed"

export type NotificationChannel = "email" | "push" | "in_app" | "sms" | string

export type PenaltyType = "late_fee" | "strike" | "collateral_loss" | "suspension"

export type ContributionStatus = "confirmed" | "pending" | "failed" | "late"

/* ───── Domain Models ───── */

export interface User {
  id: string
  walletAddress: string
  email?: string | null
  phone?: string | null
  displayName?: string | null
  username?: string | null
  avatarIpfsHash?: string | null
  countryCode?: string | null
  preferredLanguage: string
  moiScore: number
  /** Savings + currency preferences (backend 061), via PATCH /users/me. */
  savingsAutoReserve?: boolean
  savingsDefaultTarget?: number
  savingsDefaultFrequency?: string
  savingsNotifyOnMilestone?: boolean
  savingsMilestoneThreshold?: number
  preferredCurrency?: string
  totpEnabled?: boolean
  /** Backend role claim ("user" | "admin"). Absent on cached profiles that
      predate the admin section; treat missing as non-admin. */
  role?: string
  sessionTtlMinutes?: number
  createdAt: string
}

export interface Circle {
  id: string
  contractId?: string | null
  name: string
  description?: string | null
  circleType: CircleType
  payoutType: PayoutType
  contributionAmount: number
  currency: Currency
  frequency: Frequency
  maxMembers: number
  minMoiScore?: number | null
  collateralPercent: number
  lateFeePercent: number
  gracePeriodHours: number
  maxStrikes: number
  autoDebit: boolean
  /** Invite-only gate independent of circleType (backend requiresInvite). */
  requiresInvite?: boolean | null
  startDate?: string | null
  endDate?: string | null
  status: CircleStatus
  currentRound: number
  totalContributions: number
  organizerId: string
  organizerName?: string | null
  memberCount?: number | null
  createdAt: string
}

export interface CircleMember {
  id: string
  circleId: string
  userId: string
  position: number
  status: MemberStatus
  userName?: string | null
  username?: string | null
  displayName?: string | null
  userAddress?: string | null
  joinedAt: string
}

export interface Subscription {
  id: string
  userId: string
  circleId: string
  amount: string
  capTotal: string
  collectedTotal: string
  status: "active" | "paused" | "cancelled" | "completed"
  nextDebitAt: string
  lastDebitAt?: string | null
  lastRemindedAt?: string | null
  lastRound: number
  createdAt: string
  updatedAt: string
}

export interface Contribution {
  id: string
  circleId: string
  userId: string
  roundNumber: number
  amount: number
  txnHash?: string | null
  status: ContributionStatus
  onTime: boolean
  createdAt: string
}

export interface Payout {
  id: string
  circleId: string
  recipientId: string
  roundNumber: number
  amount: number
  feeAmount?: number | null
  txnHash?: string | null
  payoutType: PayoutType
  createdAt: string
}

/** One recipient leg of a payout preview distribution. */
export interface PayoutRecipientDistribution {
  recipientId: string
  grossAmount: number
  feeAmount: number
  netAmount: number
}

/**
 * Dry-run breakdown returned by POST /circles/:id/payout/preview.
 * Display-only: previews never record a payout.
 */
export interface PayoutPreview {
  circleId: string
  roundNumber: number
  currency: string
  totalGrossAmount: number
  totalNetAmount: number
  protocolFee: number
  /** Estimated Arc network fee in USDC (USDC is gas on Arc). */
  arcFeeEstimate: number
  recipients: PayoutRecipientDistribution[]
  dryRun: boolean
  /** True when the round has started and has no recorded payout yet. */
  isDue: boolean
}

/** Body for POST /circles/:id/payout (distribution trigger). */
export interface TriggerPayoutPayload {
  recipientId: string
  roundNumber: number
  amount: number
  feeAmount: number
  /** Arc distribution transaction hash (0x...). Required: the on-chain receipt. */
  txnHash: string
  payoutType: PayoutType
}

export interface CircleRound {
  roundNumber: number
  contributions: Contribution[]
  payout?: Payout
}

export interface Penalty {
  id: string
  circleId: string
  userId: string
  roundNumber: number
  penaltyType: PenaltyType
  amount: number
  strikesApplied?: number | null
  reason?: string | null
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  body?: string | null
  data?: Record<string, unknown> | null
  isRead: boolean
  isArchived?: boolean
  channel: NotificationChannel
  sentAt?: string | null
  createdAt: string
}

export interface Invite {
  id: string
  circleId: string
  code: string
  createdBy: string
  maxUses: number
  useCount: number
  expiresAt?: string | null
  createdAt: string
}

/* ───── Moi Score ───── */

export interface MoiScoreBreakdown {
  streaks: number
  completions: number
  volume: number
  recency: number
}

export interface MoiScoreHistoryEntry {
  date: string
  score: number
  reason?: string
}

export interface MoiScore {
  score: number
  breakdown: MoiScoreBreakdown
  history: MoiScoreHistoryEntry[]
}

/* ───── API Response ───── */

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  meta?: PaginationMeta
  [key: string]: unknown
}

/* ───── Form Data ───── */

export interface CircleFormData {
  name: string
  description?: string
  circleType: CircleType
  payoutType: PayoutType
  contributionAmount: number
  currency: Currency
  frequency: Frequency
  maxMembers: number
  minMoiScore?: number
  collateralPercent?: number
  lateFeePercent: number
  gracePeriodHours: number
  maxStrikes: number
  startDate: string
  requiresInvite?: boolean
  autoDebit: boolean
}

/* ───── State ───── */

export interface AuthState {
  isAuthenticated: boolean
  user?: User | null
  token?: string | null
  refreshToken?: string | null
  isLoading: boolean
}

export interface WalletState {
  isConnected: boolean
  address?: string | null
  balance?: {
    usdc: string
  } | null
  network?: string | null
}
