// Little Days feed-alarm Edge Function.
// - Called every minute by pg_cron (header x-cron-secret) -> sends overdue-feed pushes.
// - Called by a signed-in user with {"action":"test"} -> sends a test push to that user's own devices.
// Keys come from Supabase Vault through a service-role-only RPC; nothing secret is in this file.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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
type Sub = { endpoint: string; p256dh: string; auth: string };
async function send(sub: Sub, payload: Record<string, unknown>) {
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
const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const c = await config();
    const body = await req.json().catch(() => ({}));
    // 1) user test push
    if (body.action === "test") {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
      const { data: u, error } = await admin.auth.getUser(token);
      if (error || !u?.user) return json({ error: "Please sign in" }, 401);
      const { data: subs } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", u.user.id);
      const results = await Promise.all((subs || []).map((s) => send(s, { title: "Little Days 🍼", body: "Test alert: feeding alarms are working on this phone.", tag: "test" })));
      return json({ devices: results.length, results });
    }
    // 2) cron run
    if (req.headers.get("x-cron-secret") !== c.feed_alarm_cron_secret) return json({ error: "forbidden" }, 403);
    const { data: rows, error } = await admin.rpc("feed_alarm_claim");
    if (error) throw error;
    const results = await Promise.all((rows || []).filter((r: Sub | null) => r && r.endpoint).map((r: any) =>
      send(r, {
        title: r.kind === "due" ? `${r.baby_name}'s feed is due 🍼` : `Reminder: ${r.baby_name}'s feed`,
        body: r.overdue_min > 0 ? `Last feed was ${fmt(Math.round((Date.now() - Date.parse(r.last_feed_at)) / 60000))} ago (${fmt(r.overdue_min)} past the alarm).` : `It's been the full interval since the last feed.`,
        tag: "feed-" + r.baby_id, babyId: r.baby_id, kind: r.kind,
      })));
    return json({ claimed: (rows || []).length, results });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
