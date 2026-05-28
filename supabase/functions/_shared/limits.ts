// Operational guardrails to bound Edge Function memory/time.
export const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB per document/download
export const MAX_DOCS_PER_SESSION = 10;        // documents embeddable per consent session
export const MAX_TOTAL_PDF_BYTES = 40 * 1024 * 1024; // total source bytes merged in one sign
export const MAX_OTP_SENDS_PER_SESSION = 5;    // OTP deliveries per signing session
