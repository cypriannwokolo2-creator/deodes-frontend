"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Inbox,
  UserPlus,
  Settings,
  Wallet,
  Play,
  ChevronRight,
} from "lucide-react";
import {
  useCircle,
  useCircleMembers,
  useContribute,
  useJoinCircle,
  useStartCircle,
} from "@/hooks/use-circles";
import { useSubscribe } from "@/hooks/use-subscriptions";
import { useCirclePayouts } from "@/hooks/use-payouts";
import { useAuth } from "@/hooks/use-auth";
import { useUIStore } from "@/stores/ui-store";
import {
  validateArcTxHash,
  validateContributeInput,
} from "@/lib/contributions/validation";
import {
  getJoinBlockMessage,
  getJoinBlockReason,
  needsInvite,
} from "@/lib/circles/joinability";
import { PageHeader } from "@/components/shared/page-header";
import { Button, ButtonLink } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import dynamic from "next/dynamic";
import { CircleMembersPreview } from "./circle-members-preview";
import { AutoDebitCard } from "./components/auto-debit-card";
import { AutoPayPrompt } from "./components/auto-pay-prompt";
import { PrintSummaryButton } from "./print/print-summary-button";
import { CircleStatCards } from "./circle-stat-cards";
import { CircleRoundTimeline } from "./circle-round-timeline";
import { CirclePayoutsList } from "./circle-payouts-list";
import { CirclePayoutTrigger } from "./circle-payout-trigger";
import { CircleExitSection } from "./circle-exit-section";
import { useInviteGeneration } from "./use-invite-generation";

const CircleContributeModal = dynamic(
  () => import("./circle-contribute-modal").then((m) => m.CircleContributeModal),
  { ssr: false }
);

const CircleInviteModal = dynamic(
  () => import("./circle-invite-modal").then((m) => m.CircleInviteModal),
  { ssr: false }
);

const CircleJoinCodeModal = dynamic(
  () => import("./circle-join-code-modal").then((m) => m.CircleJoinCodeModal),
  { ssr: false }
);

const CIRCLE_SUB_NAV = (circleId: string, isOrganizer: boolean) => [
  { href: `/circles/${circleId}/activity`, label: "Activity" },
  { href: `/circles/${circleId}/analytics`, label: "Analytics" },
  { href: `/circles/${circleId}/schedule`, label: "Schedule" },
  { href: `/circles/${circleId}/comments`, label: "Comments" },
  { href: `/circles/${circleId}/members`, label: "Members" },
  { href: `/circles/${circleId}/rounds`, label: "Rounds" },
  { href: `/circles/${circleId}/export`, label: "Export" },
  ...(isOrganizer
    ? [{ href: `/circles/${circleId}/settings`, label: "Settings" }]
    : []),
];

export default function CircleDetailPage() {
  const params = useParams();
  const circleId = params.id as string;

  const { user } = useAuth();
  const { data: circle, isLoading, isError } = useCircle(circleId);
  const { data: members = [] } = useCircleMembers(circleId);
  const {
    data: payoutData,
    isLoading: payoutsLoading,
    isError: payoutsError,
  } = useCirclePayouts(circleId, { limit: 5 });
  const contribute = useContribute(circleId);
  const joinCircle = useJoinCircle();
  const startCircle = useStartCircle();
  const addToast = useUIStore((s) => s.addToast);

  const [showContributeModal, setShowContributeModal] = useState(false);
  const [contributeTxnHash, setContributeTxnHash] = useState("");
  const [contributeError, setContributeError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // Auto-circle consent: explicit opt-in checkbox, unchecked by default.
  const [autoDebitConsent, setAutoDebitConsent] = useState(false);
  const subscribe = useSubscribe();

  const [showJoinCodeModal, setShowJoinCodeModal] = useState(false);
  const [joinCodeValue, setJoinCodeValue] = useState("");
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

  const invite = useInviteGeneration(circleId);

  const isOrganizer = user?.id === circle?.organizerId;
  const isMember = members.some((m) => m.userId === user?.id);
  const recentPayouts = payoutData?.payouts ?? [];
  // Client-side requirements check mirrors the server's join gates
  // (status, seats, USDC rail, invite, DeoScore) so the viewer gets a clear
  // reason instead of a bare failed request.
  const joinBlock = circle
    ? getJoinBlockReason(circle, {
        moiScore: user?.moiScore ?? 0,
        isMember,
        memberCount: members.length > 0 ? members.length : (circle.memberCount ?? 0),
      })
    : null;
  const inviteGated =
    circle != null &&
    !isMember &&
    (circle.status === "pending" || circle.status === "active") &&
    needsInvite(circle);
  const canJoinDirect = circle != null && !isMember && joinBlock === null;
  const canContribute = isMember && circle?.status === "active";

  const joinCheckInput = () => ({
    moiScore: user?.moiScore ?? 0,
    isMember,
    memberCount: members.length > 0 ? members.length : (circle?.memberCount ?? 0),
  });

  const handleJoin = async () => {
    if (!circle) return;
    const reason = getJoinBlockReason(circle, joinCheckInput());
    if (reason !== null) {
      setJoinError(getJoinBlockMessage(reason, circle, joinCheckInput()));
      return;
    }
    // Auto circles offer a choice, never a mandate: ticked consent enrolls
    // auto-pay after join, unticked joins manual (pay each round yourself).
    const enrollAutoPay = circle?.autoDebit === true && autoDebitConsent;
    setJoinLoading(true);
    setJoinError(null);
    try {
      await joinCircle.mutateAsync({ circleId });
      await subscribeAfterJoin(enrollAutoPay);
      setJoinLoading(false);
      addToast({
        type: "success",
        title: "You've joined the circle",
        description: enrollAutoPay
          ? "Auto-pay is on — contributions pull automatically each round."
          : "Welcome in — pay each round manually from Contribute.",
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err instanceof Error ? err.message : "Failed to join circle");
      setJoinError(msg);
      setJoinLoading(false);
    }
  };

  // Auto circles pull contributions via keeper subscription. The cap defaults
  // to a full circle so one authorization covers every round. Join stands even
  // if subscribing fails (member falls back to manual until they subscribe).
  // Enrollment happens only when the member chose auto-pay at join.
  const subscribeAfterJoin = async (enroll: boolean) => {
    if (!circle?.autoDebit || !enroll) return;
    try {
      await subscribe.mutateAsync({
        circleId,
        amount: circle.contributionAmount,
        capTotal: circle.contributionAmount * circle.maxMembers,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Auto-debit could not be enabled — you joined, but future rounds stay manual until you subscribe.";
      setJoinError(msg);
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinCodeValue.trim()) return;
    if (!circle) return;
    // The code satisfies the invite gate, but seats, score, status and rail
    // still apply — surface those before posting.
    const reason = getJoinBlockReason(circle, joinCheckInput());
    if (reason !== null && reason !== "invite-only" && reason !== "already-member") {
      setJoinCodeError(getJoinBlockMessage(reason, circle, joinCheckInput()));
      return;
    }
    // Invite-code join offers the same choice as direct join: consent ticked
    // enrolls auto-pay, unticked joins manual.
    setJoinCodeLoading(true);
    setJoinCodeError(null);
    try {
      await joinCircle.mutateAsync({
        circleId,
        payload: { inviteCode: joinCodeValue.trim() },
      });
      setShowJoinCodeModal(false);
      setJoinCodeValue("");
      await subscribeAfterJoin(autoDebitConsent);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ??
        (err instanceof Error ? err.message : "Invalid invite code");
      setJoinCodeError(msg);
    } finally {
      setJoinCodeLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!circle) return;
    setContributeError(null);
    const preflight = validateContributeInput({
      amount: circle.contributionAmount,
      currency: circle.currency,
      roundNumber: circle.currentRound || 1,
      expectedAmount: circle.contributionAmount,
      isPremium: circle.circleType === "premium",
    });
    if (preflight) {
      setContributeError(preflight);
      return;
    }
    const hashError = validateArcTxHash(contributeTxnHash.trim());
    if (hashError) {
      setContributeError(`${hashError} Pay USDC on Arc first, then paste the transaction hash.`);
      return;
    }
    contribute.mutate(
      {
        amount: circle.contributionAmount,
        roundNumber: circle.currentRound || 1,
        txnHash: contributeTxnHash.trim(),
      },
      {
        onSuccess: () => {
          setShowContributeModal(false);
          setContributeTxnHash("");
          setContributeError(null);
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title=""
          breadcrumbs={[
            { label: "Circles", href: "/circles" },
            { label: "..." },
          ]}
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton variant="card" className="h-32 rounded-2xl" />
        <Skeleton variant="card" className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (isError || !circle) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Circle Not Found"
          breadcrumbs={[
            { label: "Circles", href: "/circles" },
            { label: "Not Found" },
          ]}
        />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-flagship rounded-2xl flex flex-col items-center justify-center py-20 holo-border"
        >
          <Inbox className="mb-4 h-14 w-14 text-muted-foreground" />
          <p className="font-heading text-xl font-semibold text-foreground dark:text-white">
            Circle not found
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The circle you are looking for does not exist or has been removed.
          </p>
          <ButtonLink href="/circles" className="mt-6"  variant="primary">Back to Circles</ButtonLink>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={circle.name}
        description={circle.description ?? undefined}
        breadcrumbs={[
          { label: "Circles", href: "/circles" },
          { label: circle.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                circle.status === "active"
                  ? "success"
                  : circle.status === "pending"
                    ? "warning"
                    : "default"
              }
            >
              {circle.status}
            </Badge>
        {isOrganizer && (
          <ButtonLink href={`/circles/${circleId}/settings`}
              variant="outline"
              size="sm"
              leftIcon={<Settings className="h-4 w-4" />}
            >
              Manage
            </ButtonLink>
        )}
        {isOrganizer && <PrintSummaryButton circleId={circleId} />}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5 pb-2">
        {CIRCLE_SUB_NAV(circleId, isOrganizer).map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-body font-medium glass-whisper text-muted-foreground hover:text-foreground hover:glass-premium transition-all"
          >
            {link.label}
          </Link>
        ))}
      </div>

      <CircleStatCards
        circle={circle}
        members={members}
        isMember={isMember}
        currentUserId={user?.id}
      />

      <CircleRoundTimeline circle={circle} />

      <div className="flex flex-wrap items-center gap-3">
        {canContribute && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="primary"
              size="lg"
              leftIcon={<Wallet className="h-5 w-5" />}
              onClick={() => setShowContributeModal(true)}
              className="h-14 w-full md:w-auto holo-glow"
            >
              Contribute{" "}
              {formatCurrency(circle.contributionAmount, circle.currency)}
            </Button>
          </motion.div>
        )}
        {(canJoinDirect || inviteGated) && circle?.autoDebit && (
          <div className="rounded-xl border border-aurora-violet/30 bg-aurora-violet/[0.06] px-5 py-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={autoDebitConsent}
                onChange={(e) => setAutoDebitConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-aurora-violet"
              />
              <span className="text-sm leading-relaxed text-foreground">
                <strong className="font-heading">Auto-pay from my Deodes balance:</strong> authorize
                automatic debits of{" "}
                <strong>
                  {formatCurrency(circle.contributionAmount, circle.currency)}
                </strong>{" "}
                every {circle.frequency} round (up to{" "}
                {formatCurrency(circle.contributionAmount * circle.maxMembers, circle.currency)}{" "}
                total). Skipped — never overdrafted — when my balance is short.
                Leave unticked to join manual and pay each round myself.
                I can switch anytime.
              </span>
            </label>
          </div>
        )}
        {inviteGated && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="primary"
              size="lg"
              leftIcon={<UserPlus className="h-5 w-5" />}
              onClick={() => setShowJoinCodeModal(true)}
            >
              Join with Invite Code
            </Button>
          </motion.div>
        )}
        {canJoinDirect && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="primary"
              size="lg"
              leftIcon={<UserPlus className="h-5 w-5" />}
              onClick={handleJoin}
              isLoading={joinLoading}
            >
              Join Circle
            </Button>
          </motion.div>
        )}
        {!isMember && joinBlock !== null && joinBlock !== "invite-only" && circle && (
          <p role="note" className="w-full rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-muted-foreground">
            {getJoinBlockMessage(joinBlock, circle, joinCheckInput())}
          </p>
        )}
        {isOrganizer && circle.status === "pending" && members.length >= 2 && (
          <Button
            variant="premium"
            size="lg"
            leftIcon={<Play className="h-5 w-5" />}
            onClick={() =>
              startCircle.mutate(circleId, {
                onSuccess: () =>
                  addToast({
                    type: "success",
                    title: "Rounds started!",
                    description: "Your circle is now active.",
                  }),
                onError: (err) => {
                  const m =
                    (err as { response?: { data?: { error?: string } } })
                      ?.response?.data?.error ??
                    (err instanceof Error ? err.message : "Failed to start");
                  addToast({
                    type: "error",
                    title: "Failed to start",
                    description: m,
                  });
                },
              })
            }
            isLoading={startCircle.isPending}
          >
            Start Rounds
          </Button>
        )}
        {isOrganizer && (
          <Button
            variant="outline"
            size="lg"
            leftIcon={<UserPlus className="h-5 w-5" />}
            onClick={invite.generate}
            isLoading={invite.isLoading}
          >
            Invite Members
          </Button>
        )}

        {joinError && (
          <div role="alert" aria-live="assertive" className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {joinError}
          </div>
        )}
        {isMember && circle?.autoDebit && (
          <AutoDebitCard
            circleId={circleId}
            contributionAmount={circle.contributionAmount}
            currency={circle.currency}
            frequency={circle.frequency}
          />
        )}
        {isMember && circle?.autoDebit && (
          <AutoPayPrompt
            circleId={circleId}
            contributionAmount={circle.contributionAmount}
            maxMembers={circle.maxMembers}
            currency={circle.currency}
            frequency={circle.frequency}
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold text-foreground dark:text-white">
            Members
          </h3>
          <Link
            href={`/circles/${circleId}/members`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 font-body"
          >
            View All ({members.length}) <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <CircleMembersPreview members={members} />
      </div>

      <CirclePayoutTrigger circle={circle} members={members} isOrganizer={isOrganizer} />

      <CircleExitSection
        circle={circle}
        members={members}
        isMember={isMember}
        isOrganizer={isOrganizer}
      />

      <CirclePayoutsList
        circle={circle}
        circleId={circleId}
        payouts={recentPayouts}
        isLoading={payoutsLoading}
        isError={payoutsError}
      />

      <CircleContributeModal
        circle={circle}
        isOpen={showContributeModal}
        onClose={() => {
          setShowContributeModal(false);
          setContributeError(null);
        }}
        onConfirm={handleContribute}
        isSubmitting={contribute.isPending}
        txnHash={contributeTxnHash}
        onTxnHashChange={(v) => {
          setContributeTxnHash(v);
          setContributeError(null);
        }}
        txnHashError={contributeError}
      />

      <CircleInviteModal
        isOpen={invite.isOpen}
        onClose={invite.close}
        code={invite.code}
        inviteUrl={invite.inviteUrl}
        expiresAt={invite.expiresAt}
        ttlHours={invite.ttlHours}
        isError={invite.isError}
        error={invite.error}
      />

      <CircleJoinCodeModal
        isOpen={showJoinCodeModal}
        onClose={() => {
          setShowJoinCodeModal(false);
          setJoinCodeValue("");
          setJoinCodeError(null);
        }}
        value={joinCodeValue}
        onChange={setJoinCodeValue}
        onSubmit={handleJoinWithCode}
        isLoading={joinCodeLoading}
        error={joinCodeError}
      />
    </div>
  );
}
