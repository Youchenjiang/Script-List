console.log("[*] Loading Toast Hook Script...");

function tryHookJava() {
    if (typeof Java === 'undefined') {
        console.log("[-] Error: Frida Java bridge is not loaded at all.");
        return;
    }

    if (!Java.available) {
        console.log("[!] Java.available is false. Checking for libart.so...");
        var libart = Process.findModuleByName("libart.so");
        if (libart) {
            console.log("[*] libart.so found at: " + libart.base);
            console.log("[!] The Java VM is present but not ready.");
            console.log("    This usually means an architecture mismatch (ARM APK on x86 Emulator).");
            console.log("    The script will try to attach ONCE, but if it fails, it won't spam you.");

            console.log("[*] Attempting to force Java.perform anyway...");
        } else {
            console.log("[-] libart.so NOT found. This is likely a Native (C/C++) or Flutter app.");
            console.log("[-] Java hooks will NOT work on this app.");
            return;
        }
    }

    Java.perform(function () {
        console.log("[+] Java attached successfully!");
        try {
            var Toast = Java.use("android.widget.Toast");
            var StringClass = Java.use("java.lang.String");

            Toast.makeText.overload('android.content.Context', 'java.lang.CharSequence', 'int').implementation = function (context, text, duration) {
                var newText = StringClass.$new(text.toString() + " [Hacked by Frida 👻]");
                console.log("[*] Intercepted Toast: " + text + " -> " + newText);
                return this.makeText(context, newText, duration);
            };
            console.log("[+] Toast hook installed.");
        } catch (e) {
            console.log("[-] Error hooking Toast: " + e);
        }
    });
}

// Try once after a short delay to let things settle
setTimeout(tryHookJava, 1000);
