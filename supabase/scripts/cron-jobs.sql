-- pg_cron jobs for the cloud project. Run in the Supabase SQL editor after
-- replacing the two placeholders. Safe to re-run: each job is unscheduled first.
--
-- WHY THIS FILE EXISTS
-- The jobs were originally created by hand from a snippet that called
-- extensions.http_post(). That function does not exist in this project — pg_net
-- installs into the `net` schema — so every run since setup failed with:
--
--   ERROR: function extensions.http_post(url => unknown, headers => jsonb,
--          body => unknown) does not exist
--
-- pg_cron records the failure in cron.job_run_details and moves on, so the jobs
-- looked "active" while nothing ever ran: scheduled SMS (morning reminder,
-- arrival reminder, post-visit follow-up) piled up in notifications_log with
-- status 'pending', vaccination reminders never went out, and the weekly prompt
-- analysis never ran. Only the booking confirmation worked, because the agent
-- sends that one in-process rather than through the queue.
--
-- Check the jobs are actually working, rather than merely scheduled:
--   select jobid, status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 10;

-- Placeholders:
--   <AGENT_PUBLIC_URL>   e.g. https://voxly-agent.fly.dev  (no trailing slash)
--   <JOBS_BEARER_TOKEN>  agent/.env JOBS_BEARER_TOKEN

select cron.unschedule('process-sms-notifications')
where exists (select 1 from cron.job where jobname = 'process-sms-notifications');

select cron.schedule(
  'process-sms-notifications',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/process-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.unschedule('send-vaccination-reminders')
where exists (select 1 from cron.job where jobname = 'send-vaccination-reminders');

select cron.schedule(
  'send-vaccination-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/send-vaccination-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

select cron.unschedule('analyze-tomer-conversations')
where exists (select 1 from cron.job where jobname = 'analyze-tomer-conversations');

select cron.schedule(
  'analyze-tomer-conversations',
  '0 6 * * 0',
  $$
  select net.http_post(
    url     := '<AGENT_PUBLIC_URL>/jobs/analyze-conversations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <JOBS_BEARER_TOKEN>',
      'Content-Type', 'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
