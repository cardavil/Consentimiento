package org.consentia.gateway

import android.content.Context
import fi.iki.elonen.NanoHTTPD
import org.consentia.gateway.security.ApiKeyCheck
import org.consentia.gateway.security.HmacVerifier
import org.consentia.gateway.security.NonceStore
import org.consentia.gateway.security.RateLimiter
import org.consentia.gateway.security.TimestampCheck
import org.json.JSONObject

/**
 * Embedded HTTP server. POST /send validates the 5 security layers, then sends the SMS.
 * Request: { to, message, timestamp, nonce, signature }; header x-api-key.
 * Canonical signed string: "to|message|timestamp|nonce" (HMAC-SHA256, hex).
 */
class HttpServer(
    private val context: Context,
    private val store: PairingStore,
    port: Int = 8080,
) : NanoHTTPD(port) {

    private val rateLimiter = RateLimiter()

    override fun serve(session: IHTTPSession): Response {
        if (session.method != Method.POST || session.uri != "/send") return json(404, false, "NOT_FOUND")

        val files = HashMap<String, String>()
        try { session.parseBody(files) } catch (_: Exception) { return json(400, false, "BAD_BODY") }
        val body = files["postData"] ?: return json(400, false, "EMPTY")

        // Layer 1 — API key
        if (!ApiKeyCheck.valid(session.headers["x-api-key"], store.apiKey)) return json(401, false, "BAD_API_KEY")
        // Layer 5 — rate limit
        if (!rateLimiter.allow()) return json(429, false, "RATE_LIMITED")

        val j = try { JSONObject(body) } catch (_: Exception) { return json(400, false, "BAD_JSON") }
        val to = j.optString("to")
        val message = j.optString("message")
        val timestamp = j.optLong("timestamp", 0)
        val nonce = j.optString("nonce")
        val signature = j.optString("signature")
        if (to.isEmpty() || message.isEmpty() || nonce.isEmpty() || signature.isEmpty()) return json(400, false, "MISSING")

        // Layer 2 — timestamp window
        if (!TimestampCheck.valid(timestamp)) return json(401, false, "BAD_TIMESTAMP")
        // Layer 3 — nonce anti-replay
        if (!NonceStore.isFresh(nonce)) return json(409, false, "REPLAY")
        // Layer 4 — HMAC
        val secret = store.hmacSecret ?: return json(401, false, "NOT_PAIRED")
        if (!HmacVerifier.valid(secret, "$to|$message|$timestamp|$nonce", signature)) return json(401, false, "BAD_SIGNATURE")

        return try {
            SmsSender.send(context, to, message)
            json(200, true, null)
        } catch (_: Exception) {
            json(500, false, "SMS_FAILED")
        }
    }

    private fun json(code: Int, ok: Boolean, error: String?): Response {
        val status = object : Response.IStatus {
            override fun getDescription() = code.toString()
            override fun getRequestStatus() = code
        }
        val payload = if (ok) "{\"ok\":true}" else "{\"ok\":false,\"error\":\"$error\"}"
        return newFixedLengthResponse(status, "application/json", payload)
    }
}
