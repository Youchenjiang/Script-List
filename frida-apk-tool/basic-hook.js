console.log("[*] Script attached to Gadget.");

if (Java.available) {
    Java.perform(function () {
        console.log("[+] Java is available. Installing hooks...");

        // Hook Activity.onResume to see screen transitions
        var Activity = Java.use("android.app.Activity");
        Activity.onResume.implementation = function () {
            console.log("[*] Activity Resumed: " + this.getClass().getName());
            this.onResume(); // Call original method
        };

        console.log("[+] Hooks installed! Try interacting with the app.");
    });
} else {
    console.log("[-] ERROR: Java is still not available.");
}


