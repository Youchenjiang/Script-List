package com.example.vulnerableapp

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity

/**
 * ⚠️ VULNERABLE — Intent Redirection 漏洞點
 *
 * 支援兩種攻擊方式：
 * 1. putExtra("target_intent", Intent) — Parcelable Intent（需同 process 或 API < 33）
 * 2. putExtra("target_component", "com.pkg/.Activity") — 字串 component name（更通用）
 *
 * 兩種都是真實漏洞場景
 */
class ProxyActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.w("DAST", "=== ProxyActivity launched ===")
        Log.w("DAST", "Extras: ${intent.extras?.keySet()?.joinToString()}")

        var targetIntent: Intent? = null

        // 方法 1: 從 Parcelable extra 取得巢狀 Intent
        targetIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra("target_intent", Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra("target_intent")
        }

        if (targetIntent != null) {
            Log.w("DAST", "Got Parcelable target_intent: ${targetIntent.component}")
        }

        // 方法 2: 從 string extra 取得目標 component（更可靠的攻擊路徑）
        if (targetIntent == null) {
            val componentStr = intent.getStringExtra("target_component")
            if (componentStr != null) {
                Log.w("DAST", "Got target_component string: $componentStr")
                targetIntent = Intent().apply {
                    // 解析 "com.example.vulnerableapp/.internal.AdminSecretActivity" 格式
                    val parts = componentStr.split("/")
                    if (parts.size == 2) {
                        val pkg = parts[0].ifEmpty { packageName }
                        val cls = parts[1].ifStartsWith(".") { "$pkg$it" }
                        component = ComponentName(pkg, cls)
                    }
                }
            }
        }

        // 方法 3: 從 target_package + target_class 取得
        if (targetIntent == null) {
            val targetPkg = intent.getStringExtra("target_package")
            val targetCls = intent.getStringExtra("target_class")
            if (targetPkg != null && targetCls != null) {
                Log.w("DAST", "Got target pkg=$targetPkg cls=$targetCls")
                targetIntent = Intent().apply {
                    component = ComponentName(targetPkg, targetCls)
                }
            }
        }

        if (targetIntent != null) {
            Log.w("DAST", "Calling startActivity -> ${targetIntent.component}")
            try {
                startActivity(targetIntent)
                Log.w("DAST", "startActivity SUCCEEDED!")
            } catch (e: Exception) {
                Log.e("DAST", "startActivity FAILED: ${e.javaClass.simpleName}: ${e.message}")
            }
        } else {
            Log.w("DAST", "No target found in extras!")
        }

        finish()
    }
}

/** 如果字串以 "." 開頭，則加上 prefix */
private fun String.ifStartsWith(prefix: String, transform: (String) -> String): String {
    return if (this.startsWith(prefix)) transform(this) else this
}
