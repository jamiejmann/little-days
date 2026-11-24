// Babyway Sign in with Apple helper.
// - store: exchange the one-time Apple authorization code for a refresh token and keep it
//   so we can revoke it later.
// - revoke: revoke that token with Apple when the person deletes their account.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets, or a secure form — never paste them in chat):
//   APPLE_CLIENT_ID  (the iOS bundle ID: com.jamiejmann.littledays)
//   APPLE_TEAM_ID
//   APPLE_KEY_ID
//   APPLE_PRIVATE_KEY  (the Sign in with Apple .p8 file contents)
// Nothing secret is in this file. Do not log tokens or keys.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function b64url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function appleSecrets() {
  const clientId = (Deno.env.get("APPLE_CLIENT_ID") || "").trim();
  const teamId = (Deno.env.get("APPLE_TEAM_ID") || "").trim();
  const keyId = (Deno.env.get("APPLE_KEY_ID") || "").trim();
  let p8 = (Deno.env.get("APPLE_PRIVATE_KEY") || "").trim();
  if (p8.includes("\\n")) p8 = p8.replace(/\\n/g, "\n");
  if (!clientId || !teamId || !keyId || !p8) return null;
  return { clientId, teamId, keyId, p8 };
}
async function clientSecret(s: { clientId: string; teamId: string; keyId: string; p8: string }) {
  const pem = s.p8.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const body = `${enc({ alg: "ES256", kid: s.keyId })}.${enc({ iss: s.teamId, iat: now, exp: now + 3600, aud: "https://appleid.apple.com", sub: s.clientId })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(body)));
  return `${body}.${b64url(sig)}`;
}
async function appleForm(url: string, params: Record<string, string>) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString() });
  const text = await r.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { data = { error: "bad-response" }; }
  return { ok: r.ok, data };
}
async function userFrom(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (!token) return null;
  const { data: u, error } = await admin.auth.getUser(token);
  return error || !u?.user ? null : u.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const u = await userFrom(req);
    if (!u) return json({ error: "Please sign in" }, 401);
    const body = await req.json().catch(() => ({})) as { action?: string; code?: string };
    const secrets = appleSecrets();

    if (body.action === "store") {
      const code = (body.code || "").trim();
      if (!code) return json({ error: "missing-code" }, 400);
      if (!secrets) return json({ skipped: true, reason: "not-configured" });
      const secret = await clientSecret(secrets);
      const { ok, data } = await appleForm("https://appleid.apple.com/auth/token", {
        client_id: secrets.clientId,
        client_secret: secret,
        code,
        grant_type: "authorization_code",
      });
      const refresh = typeof data.refresh_token === "string" ? data.refresh_token : "";
      if (!ok || !refresh) {
        console.error("apple token exchange failed");
        return json({ error: "exchange-failed" }, 400);
      }
      const { error } = await admin.rpc("upsert_apple_refresh_token", { p_user: u.id, p_token: refresh });
      if (error) {
        console.error("apple token store failed");
        return json({ error: "store-failed" }, 500);
      }
      return json({ ok: true });
    }

    if (body.action === "revoke") {
      if (!secrets) return json({ skipped: true, reason: "not-configured" });
      const { data: stored } = await admin.rpc("get_apple_refresh_token", { p_user: u.id });
      const token = typeof stored === "string" ? stored : "";
      if (!token) return json({ ok: true, revoked: false });
      const secret = await clientSecret(secrets);
      const { ok } = await appleForm("https://appleid.apple.com/auth/revoke", {
        client_id: secrets.clientId,
        client_secret: secret,
        token,
        token_type_hint: "refresh_token",
      });
      await admin.rpc("delete_apple_refresh_token", { p_user: u.id });
      if (!ok) {
        console.error("apple token revoke failed");
        return json({ ok: false, revoked: false });
      }
      return json({ ok: true, revoked: true });
    }

    return json({ error: "unknown-action" }, 400);
  } catch (e) {
    console.error("apple-auth failed");
    return json({ error: "failed" }, 500);
  }
});
