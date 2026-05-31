package org.consentia.gateway

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** Securely stores the pairing secrets (api_key + hmac_secret) shared with the server. */
class PairingStore(context: Context) {
    private val prefs = EncryptedSharedPreferences.create(
        context,
        "consentia_gateway",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var apiKey: String?
        get() = prefs.getString("api_key", null)
        set(v) = prefs.edit().putString("api_key", v).apply()

    var hmacSecret: String?
        get() = prefs.getString("hmac_secret", null)
        set(v) = prefs.edit().putString("hmac_secret", v).apply()

    var enabled: Boolean
        get() = prefs.getBoolean("enabled", false)
        set(v) = prefs.edit().putBoolean("enabled", v).apply()

    val isPaired: Boolean get() = apiKey != null && hmacSecret != null

    fun pair(apiKey: String, hmacSecret: String) {
        prefs.edit().putString("api_key", apiKey).putString("hmac_secret", hmacSecret).apply()
    }

    // --- Sesión de Consentia (login email+OTP, mismo GoTrue que la web) ---

    var accessToken: String?
        get() = prefs.getString("access_token", null)
        set(v) = prefs.edit().putString("access_token", v).apply()

    var refreshToken: String?
        get() = prefs.getString("refresh_token", null)
        set(v) = prefs.edit().putString("refresh_token", v).apply()

    var sessionExpiresAt: Long
        get() = prefs.getLong("session_expires_at", 0L)
        set(v) = prefs.edit().putLong("session_expires_at", v).apply()

    var userEmail: String?
        get() = prefs.getString("user_email", null)
        set(v) = prefs.edit().putString("user_email", v).apply()

    var tenantId: String?
        get() = prefs.getString("tenant_id", null)
        set(v) = prefs.edit().putString("tenant_id", v).apply()

    /** Sesión válida = token presente y no expirado (epoch en segundos). */
    val isLoggedIn: Boolean
        get() = accessToken != null && sessionExpiresAt > (System.currentTimeMillis() / 1000)

    fun saveSession(access: String, refresh: String, expiresAt: Long, email: String, tenant: String) {
        prefs.edit()
            .putString("access_token", access)
            .putString("refresh_token", refresh)
            .putLong("session_expires_at", expiresAt)
            .putString("user_email", email)
            .putString("tenant_id", tenant)
            .apply()
    }

    fun clearSession() {
        prefs.edit()
            .remove("access_token").remove("refresh_token").remove("session_expires_at")
            .remove("user_email").remove("tenant_id")
            .apply()
    }
}
