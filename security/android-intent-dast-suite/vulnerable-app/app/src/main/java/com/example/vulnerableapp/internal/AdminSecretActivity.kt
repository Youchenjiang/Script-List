package com.example.vulnerableapp.internal

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * 🔒 私有頁面 — 不應該被外部 App 啟動
 * 包含敏感管理功能的畫面
 */
class AdminSecretActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val textView = TextView(this).apply {
            text = "🔒 Admin Secret Area\n\n" +
                   "If you can see this from an external app,\n" +
                   "the Intent Redirection vulnerability is CONFIRMED."
            textSize = 18f
            setPadding(48, 48, 48, 48)
        }
        setContentView(textView)
    }
}
