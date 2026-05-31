package org.consentia.gateway

import android.content.Intent
import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.consentia.gateway.databinding.ActivityLoginBinding
import org.json.JSONObject
import java.io.IOException

/**
 * Login email + OTP contra Supabase Auth (GoTrue), igual que el login de la web:
 *   POST /auth/v1/otp     { email, create_user:false }   → envía el código por correo
 *   POST /auth/v1/verify  { type:email, email, token }    → devuelve la sesión
 * Solo cuentas con tenant_id (inscritos) pueden entrar a la configuración del gateway.
 */
class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var store: PairingStore
    private val http = OkHttpClient()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private var email: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = PairingStore(this)
        if (store.isLoggedIn) { goToMain(); return }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        showEmailPhase()

        binding.btnSendOtp.setOnClickListener { sendOtp() }
        binding.btnVerify.setOnClickListener { verifyOtp() }
        binding.btnBack.setOnClickListener { showEmailPhase() }
    }

    private fun showEmailPhase() {
        binding.phaseOtp.visibility = View.GONE
        binding.phaseEmail.visibility = View.VISIBLE
    }

    private fun showOtpPhase() {
        binding.phaseEmail.visibility = View.GONE
        binding.phaseOtp.visibility = View.VISIBLE
        binding.tvOtpDest.text = email
    }

    private fun sendOtp() {
        val e = binding.etEmail.text.toString().trim().lowercase()
        if (!e.contains("@") || !e.contains(".")) { toast("Email inválido"); return }
        email = e
        setBusy(true)
        val body = JSONObject().put("email", e).put("create_user", false).toString().toRequestBody(jsonType)
        val req = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/otp")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post(body).build()
        http.newCall(req).enqueue(object : Callback {
            override fun onFailure(call: Call, ex: IOException) = ui { setBusy(false); toast("Error de conexión") }
            override fun onResponse(call: Call, response: Response) {
                response.body?.close()
                ui {
                    setBusy(false)
                    if (response.isSuccessful) showOtpPhase() else toast("No se pudo enviar el código")
                }
            }
        })
    }

    private fun verifyOtp() {
        val code = binding.etOtp.text.toString().trim()
        if (code.isEmpty()) return
        setBusy(true)
        val body = JSONObject().put("type", "email").put("email", email).put("token", code).toString().toRequestBody(jsonType)
        val req = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/auth/v1/verify")
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post(body).build()
        http.newCall(req).enqueue(object : Callback {
            override fun onFailure(call: Call, ex: IOException) = ui { setBusy(false); toast("Error de conexión") }
            override fun onResponse(call: Call, response: Response) {
                val txt = response.body?.string() ?: ""
                ui {
                    setBusy(false)
                    if (!response.isSuccessful) { toast("Código inválido o expirado"); return@ui }
                    runCatching {
                        val j = JSONObject(txt)
                        val access = j.getString("access_token")
                        val refresh = j.optString("refresh_token", "")
                        val expiresAt = j.optLong("expires_at", System.currentTimeMillis() / 1000 + 3600)
                        val meta = j.getJSONObject("user").optJSONObject("app_metadata") ?: JSONObject()
                        val tenant = meta.optString("tenant_id", "")
                        if (tenant.isEmpty()) { toast("Esta cuenta no es un inscrito de Consentia"); return@ui }
                        store.saveSession(access, refresh, expiresAt, email, tenant)
                        goToMain()
                    }.onFailure { toast("Respuesta inválida del servidor") }
                }
            }
        })
    }

    private fun goToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }

    private fun setBusy(b: Boolean) {
        binding.btnSendOtp.isEnabled = !b
        binding.btnVerify.isEnabled = !b
    }

    private fun ui(block: () -> Unit) = runOnUiThread(block)

    private fun toast(msg: String) =
        android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_SHORT).show()
}
