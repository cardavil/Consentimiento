-- Add session_type (consent/firma) and otp_channel to signing_sessions_results.
-- firmar.js branches on session_type; otp_channel records the F2 verification channel.

ALTER TABLE signing_sessions_results
    ADD COLUMN session_type TEXT NOT NULL DEFAULT 'consent'
        CHECK (session_type IN ('consent', 'firma'));

ALTER TABLE signing_sessions_results
    ADD COLUMN otp_channel TEXT NOT NULL DEFAULT 'email'
        CHECK (otp_channel IN ('email', 'sms', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_results_session_type
    ON signing_sessions_results (session_type);
