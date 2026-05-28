package org.consentia.gateway

import android.content.Context
import android.os.Build
import android.telephony.SmsManager

/** Sends SMS through the device SIM using the native SmsManager. */
object SmsSender {
    fun send(context: Context, to: String, message: String) {
        val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }
        val parts = sms.divideMessage(message)
        if (parts.size > 1) {
            sms.sendMultipartTextMessage(to, null, parts, null, null)
        } else {
            sms.sendTextMessage(to, null, message, null, null)
        }
    }
}
