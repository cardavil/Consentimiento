package org.consentia.gateway

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.consentia.gateway.databinding.ActivityMainBinding
import org.json.JSONObject

/** Pairing + on/off control for the SMS gateway. */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var store: PairingStore

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents ?: return@registerForActivityResult
        runCatching {
            val j = JSONObject(contents)
            val apiKey = j.getString("api_key")
            val hmac = j.getString("hmac_secret")
            store.pair(apiKey, hmac)
            toast("Vinculado correctamente")
            refresh()
        }.onFailure { toast("QR inválido") }
    }

    private val permsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { /* result handled lazily on toggle */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = PairingStore(this)
        if (!store.isLoggedIn) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        requestPermissions()

        binding.btnScan.setOnClickListener {
            scanLauncher.launch(ScanOptions().setPrompt("Escanea el QR de vinculación de Consentia").setBeepEnabled(false))
        }
        binding.btnToggle.setOnClickListener { toggle() }
        binding.btnLogout.setOnClickListener { logout() }
        refresh()
    }

    private fun logout() {
        store.clearSession()
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    private fun toggle() {
        if (!store.isPaired) { toast("Primero vincula con el QR"); return }
        if (!hasSms()) { requestPermissions(); toast("Concede el permiso de SMS"); return }
        store.enabled = !store.enabled
        if (store.enabled) GatewayService.start(this) else GatewayService.stop(this)
        refresh()
    }

    private fun refresh() {
        binding.tvStatus.text = when {
            !store.isPaired -> "Sin vincular"
            store.enabled -> "Gateway ACTIVO (puerto ${GatewayService.PORT})"
            else -> "Vinculado · gateway detenido"
        }
        binding.btnToggle.text = if (store.enabled) "Desactivar gateway" else "Activar gateway"
    }

    private fun hasSms() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED

    private fun requestPermissions() {
        val perms = mutableListOf(Manifest.permission.SEND_SMS, Manifest.permission.CAMERA)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) perms.add(Manifest.permission.POST_NOTIFICATIONS)
        permsLauncher.launch(perms.toTypedArray())
    }

    private fun toast(msg: String) =
        android.widget.Toast.makeText(this, msg, android.widget.Toast.LENGTH_SHORT).show()
}
