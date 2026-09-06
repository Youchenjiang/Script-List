package com.example.vulnerableapp

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        layout.addView(TextView(this).apply {
            text = "VulnerableApp — DAST Test Target"
            textSize = 22f
        })

        layout.addView(TextView(this).apply {
            text = "\n本 App 含有 Intent Redirection 漏洞，\n供 DAST Scanner 動態掃描驗證。"
            textSize = 16f
        })

        // 正常業務按鈕
        layout.addView(Button(this).apply {
            text = "Open Public Page (Normal)"
            setOnClickListener {
                startActivity(Intent(this@MainActivity, ProxyActivity::class.java))
            }
        })

        setContentView(layout)
    }
}
