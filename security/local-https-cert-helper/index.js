const https = require('https');
const fs = require('fs');
const path = require('path');

// 讀取本地生成的證書與私鑰（預設在 certs 資料夾）
const options = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'server.crt'))
};

https.createServer(options, (req, res) => {
  res.writeHead(200);
  res.end('Hello Secure World!');
}).listen(443, () => {
  console.log('HTTPS Server is running on https://localhost');
  console.log('Press Ctrl+C to terminate.');
});
