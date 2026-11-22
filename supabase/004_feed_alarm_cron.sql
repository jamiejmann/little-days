-- Little Days 004: every minute, ask the feed-alarm function to send due alerts (only if any baby has the alarm on)
select cron.schedule('little-days-feed-alarm', '* * * * *', $job$
  select net.http_post(
    url := 'https://dpuzbskjivrbfapadewy.supabase.co/functions/v1/feed-alarm',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name = 'feed_alarm_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
  where exists (select 1 from public.babies where feed_alarm_enabled);
$job$);
