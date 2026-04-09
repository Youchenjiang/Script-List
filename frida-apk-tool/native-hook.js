console.log("[*] Loading Native File Monitor...");

try {
    // 1. Find libc.so explicitly
    var libc = Process.getModuleByName("libc.so");
    console.log("[*] Found libc.so at: " + libc.base);

    // 2. Find 'open' export
    var openPtr = libc.getExportByName("open");
    console.log("[*] 'open' function at: " + openPtr);

    // 3. Hook it
    Interceptor.attach(openPtr, {
        onEnter: function (args) {
            try {
                this.path = args[0].readUtf8String();
                if (this.path && this.path.indexOf("/proc/") === -1 && this.path.indexOf("/sys/") === -1) {
                    console.log("[*] Opening file: " + this.path);
                }
            } catch (e) {
                // ignore
            }
        },
        onLeave: function (retval) {
        }
    });

    console.log("[+] Native Hook Installed! Click around in the app.");

} catch (e) {
    console.log("[-] Error installing native hook: " + e);
    // Fallback: List modules to see what's loaded
    console.log("[*] Loaded Modules:");
    Process.enumerateModules({
        onMatch: function (m) {
            if (m.name.indexOf("lib") === 0) console.log(" - " + m.name);
        },
        onComplete: function () { }
    });
}
