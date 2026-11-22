// Little Days feed-alarm Edge Function.
// - Called every minute by pg_cron (header x-cron-secret) -> sends overdue-feed alerts to every family member's
//   web browsers (Web Push) and iPhones running the app (APNs).
// - Called by a signed-in user with {"action":"test"} -> sends a test alert to that user's own devices.
// - Called by a signed-in user with {"action":"status"} -> tells the iOS app whether server push (APNs) is active.
// Web Push keys + the cron secret come from Supabase Vault through a service-role-only RPC.
// APNs is OFF until these Edge Function secrets exist (Supabase dashboard -> Edge Functions -> Secrets):
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (.p8 file contents), optional APNS_BUNDLE_ID (default com.jamiejmann.littledays)
// Nothing secret is in this file.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { apnsConfig, sendApns, type Payload, type Dev } from "./apns.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await admin.rpc("feed_alarm_config");
  if (error) throw error;
  cfg = data as Record<string, string>;
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public_key, cfg.vapid_private_key);
  return cfg;
}

/* ---------- Web Push (website) ---------- */
type Sub = { endpoint: string; p256dh: string; auth: string };
async function send(sub: Sub, payload: Payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 1800, urgency: "high" });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) { await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); return "expired"; }
    console.error("push failed", code, String(e));
    return "failed:" + code;
  }
}

const devChange = async (what: "expired" | "sandbox", dev: Dev) => {
  if (what === "expired") await admin.from("device_tokens").delete().eq("token", dev.token);
  else await admin.from("device_tokens").update({ environment: "sandbox" }).eq("token", dev.token);
};

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);
async function devicesFor(userIds: string[]) {
  if (!userIds.length) return { subs: [] as Sub[], devs: [] as Dev[] };
  const [s, d] = await Promise.all([
    admin.from("push_subscriptions").select("endpoint,p256dh,auth").in("user_id", userIds),
    admin.from("device_tokens").select("token,environment").in("user_id", userIds),
  ]);
  return { subs: (s.data || []) as Sub[], devs: (d.data || []) as Dev[] };
}
async function userFrom(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const { data: u, error } = await admin.auth.getUser(token);
  return error || !u?.user ? null : u.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await config();
    const body = await req.json().catch(() => ({}));
    // 1) app status: is server push active for this user's iPhone?
    if (body.action === "status") {
      const u = await userFrom(req); if (!u) return json({ error: "Please sign in" }, 401);
      const { count } = await admin.from("device_tokens").select("id", { count: "exact", head: true }).eq("user_id", u.id);
      return json({ apns: !!apnsConfig(), thisDevice: (count || 0) > 0 });
    }
    // 2) user test alert
    if (body.action === "test") {
      const u = await userFrom(req); if (!u) return json({ error: "Please sign in" }, 401);
      const { subs, devs } = await devicesFor([u.id]);
      const p = { title: "Little Days 🍼", body: "Test alert: feeding alarms are working on this phone.", tag: "test" };
      const results = await Promise.all([...subs.map((s) => send(s, p)), ...devs.map((d) => sendApns(d, p, apnsConfig(), devChange))]);
      return json({ devices: results.filter((r) => r !== "apns-disabled").length, results });
    }
    // 3) cron run
    if (req.headers.get("x-cron-secret") !== c.feed_alarm_cron_secret) return json({ error: "forbidden" }, 403);
    const { data: babies, error } = await admin.rpc("feed_alarm_claim_babies");
    if (error) throw error;
    const results: string[] = [];
    for (const r of (babies || []) as { baby_id: string; baby_name: string; kind: string; overdue_min: number; last_feed_at: string }[]) {
      const { data: mem } = await admin.from("baby_members").select("user_id").eq("baby_id", r.baby_id);
      const { subs, devs } = await devicesFor((mem || []).map((m: { user_id: string }) => m.user_id));
      const p: Payload = {
        title: r.kind === "due" ? `${r.baby_name}'s feed is due 🍼` : `Reminder: ${r.baby_name}'s feed`,
        body: r.overdue_min > 0 ? `Last feed was ${fmt(Math.round((Date.now() - Date.parse(r.last_feed_at)) / 60000))} ago (${fmt(r.overdue_min)} past the alarm).` : `It's been the full interval since the last feed.`,
        tag: "feed-" + r.baby_id, babyId: r.baby_id, kind: r.kind,
      };
      results.push(...await Promise.all([...subs.map((s) => send(s, p)), ...devs.map((d) => sendApns(d, p, apnsConfig(), devChange))]));
    }
    return json({ claimed: (babies || []).length, results });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
