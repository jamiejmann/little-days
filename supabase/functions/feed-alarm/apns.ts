// APNs (Apple Push Notification service) sender for the Babyway iOS app.
// Token-based auth: an ES256 JWT signed with the .p8 key from App Store Connect (Keys -> APNs).
// Disabled (returns "apns-disabled") until APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY are set as Edge Function secrets.
export type Payload = { title: string; body: string; tag: string; babyId?: string; kind?: string };
export type Apns = { keyId: string; teamId: string; pem: string; topic: string };
export function apnsConfig(env: (k: string) => string | undefined = (k) => Deno.env.get(k)): Apns | null {
  const keyId = env("APNS_KEY_ID"), teamId = env("APNS_TEAM_ID"), pem = env("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !pem) return null;
  return { keyId: keyId.trim(), teamId: teamId.trim(), pem: pem.replace(/\\n/g, "\n"), topic: (env("APNS_BUNDLE_ID") || "com.jamiejmann.littledays").trim() };
}
const b64url = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
let jwtCache: { tok: string; at: number; kid: string } | null = null;
let keyCache: { kid: string; key: CryptoKey } | null = null;
export async function apnsJwt(c: Apns, now = Date.now()) {
  if (jwtCache && jwtCache.kid === c.keyId && now - jwtCache.at < 40 * 60 * 1000) return jwtCache.tok; // Apple: refresh every 20-60 min
  if (!keyCache || keyCache.kid !== c.keyId) {
    const der = Uint8Array.from(atob(c.pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (ch) => ch.charCodeAt(0));
    keyCache = { kid: c.keyId, key: await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]) };
  }
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const input = enc({ alg: "ES256", kid: c.keyId }) + "." + enc({ iss: c.teamId, iat: Math.floor(now / 1000) });
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyCache.key, new TextEncoder().encode(input)));
  jwtCache = { tok: input + "." + b64url(sig), at: now, kid: c.keyId };
  return jwtCache.tok;
}
export type Dev = { token: string; environment: string };
export async function sendApns(dev: Dev, p: Payload, c: Apns | null = apnsConfig(), onChange?: (what: "expired" | "sandbox", dev: Dev) => Promise<void>): Promise<string> {
  if (!c) return "apns-disabled";
  const post = (host: string) => apnsJwt(c).then((jwt) => fetch(`https://${host}/3/device/${dev.token}`, {
    method: "POST",
    headers: { authorization: "bearer " + jwt, "apns-topic": c.topic, "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 1800), "apns-collapse-id": p.tag.slice(0, 64) },
    body: JSON.stringify({ aps: { alert: { title: p.title, body: p.body }, sound: "default", "thread-id": p.tag }, babyId: p.babyId, kind: p.kind }),
  }));
  try {
    let r = await post(dev.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com");
    if (r.ok) return "sent";
    let reason = ((await r.json().catch(() => ({}))) as { reason?: string }).reason || "";
    if (reason === "BadDeviceToken" && dev.environment !== "sandbox") { // a development build's token: try the sandbox once
      r = await post("api.sandbox.push.apple.com");
      if (r.ok) { await onChange?.("sandbox", dev); return "sent"; }
      reason = ((await r.json().catch(() => ({}))) as { reason?: string }).reason || "";
    }
    if (r.status === 410 || reason === "Unregistered") { await onChange?.("expired", dev); return "expired"; }
    console.error("apns failed", r.status, reason);
    return "failed:" + r.status + ":" + reason;
  } catch (e) { console.error("apns error", String(e)); return "failed:" + String(e); }
}
