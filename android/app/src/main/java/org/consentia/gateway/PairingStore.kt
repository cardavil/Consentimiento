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
}
