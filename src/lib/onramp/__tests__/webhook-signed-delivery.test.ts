// TEMPORARY positive-path proof (deleted after run): a correctly HMAC-signed
// rampSession.completed delivery must verify via hmac, classify as settled,
// and produce a stable dedupe key. Uses a throwaway secret — never prod keys.
import { describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import {
  verifyCircleWebhook,
  parseDepositEvent,
  dedupeKeyFor,
} from "@/lib/onramp/webhook";

const SECRET = "throwaway-proof-secret-only";

function sign(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("webhook positive-path proof", () => {
  it("accepts a correctly signed rampSession.completed as settled", async () => {
    const body = JSON.stringify({
      event: "rampSession.completed",
      id: "evt-proof-123",
      payload: { paymentId: "pay-proof-456", amount: "100.00", tokenSymbol: "USDC" },
    });
    const res = await verifyCircleWebhook(body, sign(body), null, {
      apiBaseUrl: "",
      apiKey: "",
      hmacSecret: SECRET,
    });
    expect(res.ok).toBe(true);
    expect(res.method).toBe("hmac");

    const parsed = parseDepositEvent(JSON.parse(body));
    expect(parsed.outcome).toBe("settled");
    expect(parsed.depositId).toBe("pay-proof-456");
    // Event id wins the dedupe key; deposit id is the fallback.
    expect(dedupeKeyFor(parsed, body)).toBe("event:evt-proof-123");
  });

  it("rejects a tampered body", async () => {
    const body = JSON.stringify({ event: "rampSession.completed", id: "x" });
    const res = await verifyCircleWebhook(body, sign(body + "tampered"), null, {
      apiBaseUrl: "",
      apiKey: "",
      hmacSecret: SECRET,
    });
    expect(res.ok).toBe(false);
  });

  it("accepts gateway.deposit.finalized as settled", async () => {
    const body = JSON.stringify({ event: "gateway.deposit.finalized", id: "gw-1" });
    const res = await verifyCircleWebhook(body, sign(body), null, {
      apiBaseUrl: "",
      apiKey: "",
      hmacSecret: SECRET,
    });
    expect(res.ok).toBe(true);
    expect(parseDepositEvent(JSON.parse(body)).outcome).toBe("settled");
  });
});
