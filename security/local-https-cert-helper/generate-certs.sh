#!/bin/bash

# 切換到腳本所在的目錄，確保路徑正確
cd "$(dirname "$0")"

CERT_DIR="./certs"
mkdir -p "$CERT_DIR"

echo "========================================="
echo "  本地 HTTPS 自簽憑證生成助手 (OpenSSL)  "
echo "========================================="

# 1. 生成 Root CA 私鑰與自我簽署的 Root CA 證書
echo "[1/3] 正在生成 Root CA..."
openssl genrsa -out "$CERT_DIR/rootCA.key" 2048
openssl req -x509 -new -nodes -key "$CERT_DIR/rootCA.key" -sha256 -days 1024 -out "$CERT_DIR/rootCA.crt" -subj "/C=TW/ST=Taiwan/L=Taipei/O=Local Test CA/CN=Local Root CA"

# 2. 生成 Server 私鑰與憑證請求 (CSR)
echo "[2/3] 正在生成伺服器私鑰與 CSR..."
openssl genrsa -out "$CERT_DIR/server.key" 2048
openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" -subj "/C=TW/ST=Taiwan/L=Taipei/O=Local Test Server/CN=localhost"

# 3. 使用 Root CA 與 v3.ext 簽署伺服器憑證
echo "[3/3] 正在簽署伺服器憑證..."
openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/rootCA.crt" -CAkey "$CERT_DIR/rootCA.key" -CAcreateserial -out "$CERT_DIR/server.crt" -days 500 -sha256 -extfile v3.ext

echo "========================================="
echo "✓ 憑證生成成功！"
echo "產生的憑證檔案存放在: $CERT_DIR"
echo ""
echo "Windows 瀏覽器信任步驟："
echo "1. 雙擊打開 $CERT_DIR/rootCA.crt"
echo "2. 點擊「安裝憑證...」-> 選擇「本機電腦」"
echo "3. 將憑證放入「信任的根憑證授權機構」"
echo "4. 重新啟動瀏覽器並執行 node index.js 進行測試"
echo "========================================="
