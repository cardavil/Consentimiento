package org.consentia.gateway.security

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** Layer 1 — API key, constant-time comparison. */
object ApiKeyCheck {
    fun valid(provided: String?, expected: String?): Boolean {
        if (provided == null || expected == null) return false
        return constantTimeEquals(provided, expected)
    }
}

/** Layer 2 — timestamp within ±skew seconds. */
object TimestampCheck {
    fun valid(timestampSeconds: Long, skewSeconds: Long = 30): Boolean {
        val now = System.currentTimeMillis() / 1000
        return kotlin.math.abs(now - timestampSeconds) <= skewSeconds
    }
}

/** Layer 3 — single-use nonce (anti-replay) with TTL eviction. */
object NonceStore {
    private const val TTL_MS = 120_000L
    private val seen = HashMap<String, Long>()

    @Synchronized
    fun isFresh(nonce: String): Boolean {
        val now = System.currentTimeMillis()
        val it = seen.entries.iterator()
        while (it.hasNext()) if (now - it.next().value > TTL_MS) it.remove()
        if (seen.containsKey(nonce)) return false
        seen[nonce] = now
        return true
    }
}

/** Layer 4 — HMAC-SHA256 of the canonical payload. */
object HmacVerifier {
    fun hex(secret: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(message.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }
    fun valid(secret: String, message: String, signature: String): Boolean =
        constantTimeEquals(hex(secret, message), signature.lowercase())
}

/** Layer 5 — sliding-window rate limiter. */
class RateLimiter(private val maxPerWindow: Int = 20, private val windowMs: Long = 60_000) {
    private val hits = ArrayDeque<Long>()

    @Synchronized
    fun allow(): Boolean {
        val now = System.currentTimeMillis()
        while (hits.isNotEmpty() && now - hits.first() > windowMs) hits.removeFirst()
        if (hits.size >= maxPerWindow) return false
        hits.addLast(now)
        return true
    }
}

internal fun constantTimeEquals(a: String, b: String): Boolean {
    val ba = a.toByteArray(Charsets.UTF_8)
    val bb = b.toByteArray(Charsets.UTF_8)
    if (ba.size != bb.size) return false
    var result = 0
    for (i in ba.indices) result = result or (ba[i].toInt() xor bb[i].toInt())
    return result == 0
}
