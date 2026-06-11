# Local HTTPS Self-Signed Certificate Helper

This tool is designed to generate self-signed certificates for local HTTPS testing and provides a simple Node.js server to demonstrate and learn how to make browsers trust local self-signed certificates.

## 📂 File Structure

* `generate-certs.sh`: An OpenSSL helper script to generate CA and server certificates in one click.
* `index.js`: A minimal Node.js HTTPS server to test the generated certificates.
* `v3.ext`: An X509 v3 extension configuration file (defining `Subject Alternative Name (SAN)` for `localhost` and `127.0.0.1`).
* `.gitignore`: Prevents private keys (`.key`) and certificates (`.crt`) from being committed to Git.

---

## 🚀 Quick Start Steps

### 1. Generate Certificates
Run the script in Git Bash or any compatible Linux environment:
```bash
./generate-certs.sh
```
This will automatically create a `certs/` directory and generate the following files:
* `rootCA.key` / `rootCA.crt`: Private key and certificate for your local Certificate Authority (CA).
* `server.key` / `server.crt`: Server private key and certificate signed by the Root CA.

---

### 2. Trust the Root CA in Your OS / Browser
Self-signed certificates are rejected by browsers by default. You need to manually import `rootCA.crt` to your system's trusted store.

#### 🌐 Windows Configuration Steps:
1. Double-click `certs/rootCA.crt` to open it.
2. Click **"Install Certificate..."**.
3. Select **"Local Machine"** as the Store Location and click Next (requires Admin privileges).
4. Select **"Place all certificates in the following store"**.
5. Click "Browse...", choose **"Trusted Root Certification Authorities"**, and click OK.
6. Click Next and Finish.

> [!TIP]
> After importing, **you must completely restart your browser** (e.g., Chrome or Edge) for the changes to take effect.

---

### 3. Run the Test Server
Ensure [Node.js](https://nodejs.org/) is installed on your machine.

Since HTTPS uses port 443 by default, running the server requires administrator/root privileges:

* **Windows (Run PowerShell/CMD as Administrator)**:
  ```bash
  node index.js
  ```
* **macOS / Linux**:
  ```bash
  sudo node index.js
  ```

Open your browser and navigate to [https://localhost](https://localhost) or [https://127.0.0.1](https://127.0.0.1). You should see a green padlock (connection is secure) and receive the text `Hello Secure World!`.

---

## 🔍 How it Works

1. **Why `v3.ext` is required?**
   Modern browsers (like Chrome 58+) no longer rely solely on the Common Name (CN) field of certificates. They strictly enforce the **Subject Alternative Name (SAN)**. The `v3.ext` file informs OpenSSL that this certificate applies to `localhost` and `127.0.0.1`, avoiding the `NET::ERR_CERT_COMMON_NAME_INVALID` error.

2. **Why generate a Root CA instead of a direct self-signed Server Certificate?**
   In real-world development, having a dedicated local Root CA simulates real certificate authority structures. Once the Root CA is trusted by your system, any certificate signed by this CA will be trusted automatically.
