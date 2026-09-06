package com.example.vulnerableapp

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.appcompat.app.AppCompatActivity

/**
 * ✅ FIXED — 加了白名單校驗的 ProxyActivity
 *
 * 修復原則（對應 1.txt 第 4 節）：
 *   在呼叫 startActivity 前，嚴格校驗目標 Component 是否合法。
 *
 * 支援 Parcelable Intent / String component / Package+Class 三種輸入，
 * 但每一種都會經過白名單校驗。
 */
class SafeProxyActivity : AppCompatActivity() {

    // 白名單：只允許這些 Activity 被代理跳轉
    private val allowedComponents = setOf(
        "com.example.vulnerableapp.MainActivity",
        // 如果有其他公開頁面，加在這裡
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Log.w("DAST", "=== SafeProxyActivity launched ===")

        var targetIntent: Intent? = null

        // 方法 1: Parcelable Intent extra
        targetIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra("target_intent", Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra("target_intent")
        }

        // 方法 2: String component extra
        if (targetIntent == null) {
            val componentStr = intent.getStringExtra("target_component")
            if (componentStr != null) {
                Log.w("DAST", "Got target_component: $componentStr")
                val parts = componentStr.split("/")
                if (parts.size == 2) {
                    val pkg = parts[0].ifEmpty { packageName }
                    val cls = parts[1].let {
                        if (it.startsWith(".")) "$pkg$it" else it
                    }
                    targetIntent = Intent().apply {
                        component = ComponentName(pkg, cls)
                    }
                }
            }
        }

        // 方法 3: Package + Class extras
        if (targetIntent == null) {
            val pkg = intent.getStringExtra("target_package")
            val cls = intent.getStringExtra("target_class")
            if (pkg != null && cls != null) {
                targetIntent = Intent().apply {
                    component = ComponentName(pkg, cls)
                }
            }
        }

        if (targetIntent != null) {
            val component = targetIntent.resolveActivity(packageManager)
            Log.w("DAST", "Resolved component: $component")

            if (component != null && isAllowedComponent(component)) {
                Log.w("DAST", "ALLOWED → starting ${component.className}")
                try {
                    startActivity(targetIntent)
                } catch (e: Exception) {
                    Log.e("DAST", "Failed: ${e.message}")
                }
            } else {
                Log.w("DAST", "🛡️ BLOCKED unauthorized intent redirection to: $component")
            }
        } else {
            Log.w("DAST", "No target found")
        }

        finish()
    }

    private fun isAllowedComponent(component: ComponentName): Boolean {
        return allowedComponents.contains(component.className)
    }
}
