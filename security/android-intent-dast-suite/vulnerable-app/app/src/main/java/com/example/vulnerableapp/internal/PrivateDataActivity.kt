package com.example.vulnerableapp.internal

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 🔒 另一個私有頁面 — 存放敏感資料
 */
class PrivateDataActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val textView = TextView(this).apply {
            text = "🔒 Private Data Area\n\n" +
                   "User token: FAKE_TOKEN_12345\n" +
                   "API key: sk-fake-key\n\n" +
                   "If you see this from outside, data is exposed."
            textSize = 18f
            setPadding(48, 48, 48, 48)
        }
        setContentView(textView)
    }
}
