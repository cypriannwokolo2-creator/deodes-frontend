// @vitest-environment node
/**
 * sessions/route.test.ts — Circle App Kit Onramp session minting.
 *
 * Covers fail-closed behavior without depending on Circle's network:
 * the SDK server module is mocked; tests exercise OUR wiring —
 * missing-key 503, anonymous 401, appUserId-must-equal-sub binding,
 * 0x destination enforcement, and per-env endpoint resolution
 * (sandbox → api-test + onramp-sandbox, production → api + onramp).
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/session-cookies";

type AuthorizeFn = (req: Request) => Promise<boolean | undefined> | boolean | undefined;

let capturedAuthorize: AuthorizeFn | null = null;
let capturedServerOptions: { onramp?: Record<string, unknown> } | null = null;

vi.mock("@circle-fin/app-kit/server", () => ({
  createAppServerKit: vi.fn((opts: unknown) => {
    capturedServerOptions =
      opts as { onramp?: Record<string, unknown> } | null;
    return {};
  }),
  createSessionRouteHandler: vi.fn(
    (_server: unknown, opts?: { authorize?: AuthorizeFn }) => {
      capturedAuthorize = opts?.authorize ?? null;
      return async (req: Request) => {
        const ok = capturedAuthorize ? await capturedAuthorize(req) : false;
        return Response.json(
          ok ? { sessionToken: "sess-test" } : { error: "unauthorized" },
          { status: ok ? 200 : 401 },
        );
      };
    },
  ),
}));

function fakeJwt(sub: string): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64({ sub, exp: 9999999999 })}.sig`;
}

function makeRequest(body: unknown, cookie?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie !== undefined) headers.cookie = cookie;
  return new NextRequest("http://localhost/api/onramp/sessions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const ARC_ADDR = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const cookieFor = (sub: string) => `${ACCESS_TOKEN_COOKIE}=${fakeJwt(sub)}`;

/** Stubs the backend GET /v1/me session check used by authorize. */
function stubBackendMe(id: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      id === null
        ? { ok: false, status: 401, json: async () => ({}) }
        : {
            ok: true,
            status: 200,
            json: async () => ({ data: { user: { id } } }),
          },
    ),
  );
}

describe("POST /api/onramp/sessions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    capturedAuthorize = null;
    capturedServerOptions = null;
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://deodes.com/v1");
    stubBackendMe("user-1");
  });

  it("returns 503 when the active env key is unset (fail-closed)", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "");
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ appUserId: "user-1", destinationAddress: ARC_ADDR }, cookieFor("user-1")),
    );
    expect(res.status).toBe(503);
  });

  it("returns 401 for anonymous callers", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest({ appUserId: "user-1", destinationAddress: ARC_ADDR }),
    );
    expect(res.status).toBe(401);
  });

  it("mints only when appUserId matches the cookie subject with a 0x destination", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    const { POST } = await import("./route");

    const ok = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(ok.status).toBe(200);

    const mismatch = await POST(
      makeRequest(
        { appUserId: "user-2", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(mismatch.status).toBe(401);

    const notEvm = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: "GABC123" },
        cookieFor("user-1"),
      ),
    );
    expect(notEvm.status).toBe(401);
  });

  it("rejects forged cookies the backend does not recognize", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    const { POST } = await import("./route");

    // Cookie parses to user-1 and body agrees, but the backend session
    // belongs to someone else: forged bearer, no mint.
    stubBackendMe("attacker");
    const forged = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(forged.status).toBe(401);

    // Backend rejects the bearer outright (expired/revoked session).
    stubBackendMe(null);
    const rejected = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(rejected.status).toBe(401);
  });

  it("toggles keys by CIRCLE_ENV (sandbox default, production key)", async () => {
    vi.stubEnv("CIRCLE_ENV", "production");
    vi.stubEnv("CIRCLE_API_KEY", "LIVE_API_KEY:x:y");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "");
    const prod = await import("./route");
    const ok = await prod.POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(ok.status).toBe(200);

    const { GET } = await import("./route");
    const envRes = await GET();
    expect(envRes.status).toBe(200);
    await expect(envRes.json()).resolves.toMatchObject({ env: "production" });
  });

  it("GET reports sandbox by default without leaking keys", async () => {
    vi.stubEnv("CIRCLE_ENV", "");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.env).toBe("sandbox");
    expect(JSON.stringify(body)).not.toContain("API_KEY");
  });

  it("passes sandbox api + widget bases to the server kit (TEST key path)", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(res.status).toBe(200);
    expect(capturedServerOptions?.onramp).toMatchObject({
      apiKey: "TEST_API_KEY:x:y",
      baseUrl: "https://api-test.circle.com",
      widgetBaseUrl: "https://onramp-sandbox.arc.io",
    });
    expect(typeof capturedServerOptions?.onramp?.referrerDomain).toBe(
      "string",
    );
  });

  it("passes production api + widget bases to the server kit (LIVE key path)", async () => {
    vi.stubEnv("CIRCLE_ENV", "production");
    vi.stubEnv("CIRCLE_API_KEY", "LIVE_API_KEY:x:y");
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(res.status).toBe(200);
    expect(capturedServerOptions?.onramp).toMatchObject({
      apiKey: "LIVE_API_KEY:x:y",
      baseUrl: "https://api.circle.com",
      widgetBaseUrl: "https://onramp.arc.io",
    });
  });

  it("honors CIRCLE_BASE_URL and CIRCLE_WIDGET_BASE_URL overrides", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    vi.stubEnv("CIRCLE_BASE_URL", "https://staging.example.com");
    vi.stubEnv("CIRCLE_WIDGET_BASE_URL", "https://widget.example.com");
    const { POST } = await import("./route");
    const res = await POST(
      makeRequest(
        { appUserId: "user-1", destinationAddress: ARC_ADDR },
        cookieFor("user-1"),
      ),
    );
    expect(res.status).toBe(200);
    expect(capturedServerOptions?.onramp).toMatchObject({
      baseUrl: "https://staging.example.com",
      widgetBaseUrl: "https://widget.example.com",
    });
  });

  it("GET probe carries the per-env widgetBaseUrl without leaking keys", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "TEST_API_KEY:x:y");
    const sandbox = await import("./route");
    const sandboxRes = await sandbox.GET();
    expect(sandboxRes.status).toBe(200);
    await expect(sandboxRes.json()).resolves.toMatchObject({
      env: "sandbox",
      configured: true,
      widgetBaseUrl: "https://onramp-sandbox.arc.io",
    });

    vi.resetModules();
    vi.stubEnv("CIRCLE_ENV", "production");
    vi.stubEnv("CIRCLE_API_KEY", "LIVE_API_KEY:x:y");
    const prod = await import("./route");
    await expect(prod.GET().then((r) => r.json())).resolves.toMatchObject({
      env: "production",
      widgetBaseUrl: "https://onramp.arc.io",
    });
  });

  it("GET never 503s when the active-env key is missing", async () => {
    vi.stubEnv("CIRCLE_ENV", "sandbox");
    vi.stubEnv("CIRCLE_TEST_API_KEY", "");
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      env: "sandbox",
      configured: false,
    });
  });
});
