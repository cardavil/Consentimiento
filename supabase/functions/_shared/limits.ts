// Operational guardrails to bound Edge Function memory/time + shared business limits.
export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB per document/download
export const MAX_DOCS_PER_SESSION = 10;        // documents embeddable per consent session
export const MAX_TOTAL_PDF_BYTES = 40 * 1024 * 1024; // total source bytes merged in one sign
export const MAX_OTP_SENDS_PER_SESSION = 5;    // OTP deliveries per signing session

export const DEFAULT_SESSION_EXPIRES_HOURS = 72; // signing link validity if caller omits it

// OTP issuance (per-email rate limit + lifetime + verification attempts)
export const OTP_TTL_MS = 5 * 60 * 1000;        // code lifetime: 5 min
export const OTP_RATE_WINDOW_MS = 10 * 60 * 1000; // window for the active-codes cap: 10 min
export const MAX_ACTIVE_OTPS = 3;               // unverified codes per email within the window
export const MAX_OTP_ATTEMPTS = 5;              // wrong tries before a code is burned
