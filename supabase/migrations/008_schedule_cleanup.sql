-- Schedule periodic cleanup: expire stale sessions and purge old OTPs.
-- Requires pg_cron (enable it in the Supabase dashboard if this CREATE EXTENSION is denied).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Every 15 minutes: mark expired sessions and drop their temp (signer) data.
SELECT cron.schedule('consentia_expire_sessions', '*/15 * * * *', 'SELECT expire_sessions();');

-- Hourly: delete OTPs expired more than 1 hour ago.
SELECT cron.schedule('consentia_cleanup_otps', '0 * * * *', 'SELECT cleanup_otps();');
