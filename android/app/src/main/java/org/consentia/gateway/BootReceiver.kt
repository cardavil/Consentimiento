package org.consentia.gateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts the gateway on device boot if it was paired and enabled. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val store = PairingStore(context)
        if (store.isPaired && store.enabled) GatewayService.start(context)
    }
}
