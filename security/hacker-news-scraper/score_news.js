// 綜合評分產生器：依四維度加權計算 0-100 分並重新排名
// 維度（各 1-10）：廣度(B) 30%｜巧思(N) 25%｜可及(E) 20%｜嚴重(S) 25%
const fs = require('fs');

const W = { b: 30, n: 25, e: 20, s: 25 };

// [id, date, title, url, tier, b, n, e, s]
const articles = [
  // ===== A 級（25） =====
  ['A-01','08-08','Metabase 零日：免認證取得管理員權限','https://thehackernews.com/2026/08/metabase-zero-day-exploited-in-wild.html','A',10,6,9,9],
  ['A-02','07-27','vBulletin 預授權 RCE 公開利用','https://thehackernews.com/2026/07/public-exploit-released-for-patched.html','A',9,6,10,8],
  ['A-03','07-27','n8n 表達式沙箱逃逸 RCE','https://thehackernews.com/2026/07/n8n-sandbox-escape-lets-workflow.html','A',8,9,8,8],
  ['A-04','07-28','OpenWrt DHCPv6 免認證 root','https://thehackernews.com/2026/07/critical-openwrt-dhcpv6-flaw-could-let.html','A',8,7,8,8],
  ['A-05','07-28/08-06','TeamCity 免登入 RCE＋野外利用（CVE-2026-63077）','https://thehackernews.com/2026/08/cisa-flags-teamcity-cve-2026-63077-rce.html','A',9,6,8,8],
  ['A-06','07-30','Rails Active Storage 任意檔案讀取','https://thehackernews.com/2026/07/critical-rails-flaw-could-let.html','A',9,7,9,7],
  ['A-07','08-01','Adobe Campaign Classic CVSS 10.0 免互動 RCE','https://thehackernews.com/2026/08/adobe-campaign-classic-cvss-100-flaw.html','A',7,6,7,10],
  ['A-08','07-29','VMware 三嚴重：認證繞過／RCE／VM 逃逸','https://thehackernews.com/2026/07/three-critical-vmware-flaws-allow-auth.html','A',7,7,7,9],
  ['A-09','07-30','Azure Cosmos DB 跨租戶沙箱逃逸','https://thehackernews.com/2026/07/azure-cosmos-db-flaw-exposed-platform.html','A',7,8,7,9],
  ['A-10','08-07','WordPress 預授權 XSS→PHP RCE','https://thehackernews.com/2026/08/new-wordpress-pre-auth-xss-could-lead.html','A',9,8,9,8],
  ['A-11','08-05','Gitea Org-Mode 免認證讀取伺服器檔案','https://thehackernews.com/2026/08/critical-gitea-flaw-let-unauthenticated.html','A',7,7,9,7],
  ['A-12','07-29','Gitea Git Hook RCE（寫入權限即 RCE）','https://thehackernews.com/2026/07/new-gitea-rce-lets-repository-writers.html','A',7,7,8,8],
  ['A-13','08-05','OVSwrap：Open vSwitch 核心 root','https://thehackernews.com/2026/08/new-ovswrap-linux-kernel-flaw-lets.html','A',6,8,6,9],
  ['A-14','08-07','SCTP 18 年 UAF：root＋容器逃逸','https://thehackernews.com/2026/08/18-year-old-linux-sctp-flaw-could-let.html','A',8,8,7,9],
  ['A-15','08-07','Cisco SD-WAN／IOS XE 12 漏洞（3×9.9）','https://thehackernews.com/2026/08/cisco-patches-12-sd-wan-and-ios-xe.html','A',8,6,7,8],
  ['A-16','08-04','cPanel：託管客戶以 DB root 執行 SQL','https://thehackernews.com/2026/08/new-cpanel-critical-flaw-could-let.html','A',7,7,8,8],
  ['A-17','08-05','Veeam／Terraform MCP／Django（CVSS 10.0）','https://thehackernews.com/2026/08/veeam-terraform-mcp-django-patch.html','A',8,6,7,9],
  ['A-18','07-31','4G/5G 核心 84 缺陷＋會話劫持','https://thehackernews.com/2026/07/researchers-report-84-flaws-in-4g-and.html','A',7,7,6,8],
  ['A-19','08-08','近 800 個惡意 npm 套件：跨平台 RAT／竊取器','https://thehackernews.com/2026/08/nearly-800-malicious-npm-packages.html','A',9,7,9,8],
  ['A-20','08-04','Keyv npm 蠕蟲毒害數百套件','https://thehackernews.com/2026/08/keyv-linked-npm-worm-poisons-hundreds.html','A',9,8,9,8],
  ['A-21','07-30','debug／chalk npm 劫持：北韓 Sapphire Sleet','https://thehackernews.com/2026/07/amazon-links-debug-and-chalk-npm-hijack.html','A',9,7,8,8],
  ['A-22','08-03','N-able N-central 接管（RMM 供應鏈）','https://thehackernews.com/2026/08/n-able-says-attackers-take-over-n.html','A',8,6,7,8],
  ['A-23','08-04','INC 勒索軟體×SonicWall SMA1000','https://thehackernews.com/2026/08/inc-ransomware-emerges-as-dominant.html','A',8,6,8,8],
  ['A-24','07-29','明尼蘇達 30+ 供水系統協同 OT 攻擊','https://thehackernews.com/2026/07/coordinated-cyberattack-targets-30.html','A',6,7,5,9],
  ['A-25','07-28','Dysphoria IoT 殭屍網路：區塊鏈 C2＋受害中繼','https://thehackernews.com/2026/07/dysphoria-iot-botnet-adds-blockchain-c2.html','A',8,9,7,8],
  // ===== B 級（50） =====
  ['B-01','08-07','NatJack：操縱 NAT 表劫持 TCP／欺騙 DNS','https://thehackernews.com/2026/08/new-natjack-attacks-hijack-tcp-sessions.html','B',7,10,8,8],
  ['B-02','08-08','CSS 攻擊突破 Webmail 訊息邊界竊取密碼','https://thehackernews.com/2026/08/new-css-attacks-can-break-webmail.html','B',7,9,8,7],
  ['B-03','08-06','khunt：在 Oracle 內編譯執行，免寫檔','https://thehackernews.com/2026/08/attackers-compile-khunt-inside-oracle.html','B',7,8,7,8],
  ['B-04','08-05','NullReceiver：空以太坊交易藏 C2 IP','https://thehackernews.com/2026/08/trojanized-npm-packages-decode-c2-ip.html','B',6,9,7,7],
  ['B-05','07-28','Tengu 殭屍網路：硬體看門狗重生','https://thehackernews.com/2026/07/tengu-botnet-reboots-compromised-linux.html','B',7,9,7,8],
  ['B-06','08-04','Google 密碼管理器：金鑰帳戶免指紋登入','https://thehackernews.com/2026/08/google-password-manager-attacks-could.html','B',7,8,6,8],
  ['B-07','08-07','Windows Hello 企業版金鑰→持久 Entra ID','https://thehackernews.com/2026/08/malware-can-abuse-windows-hello-for.html','B',7,8,6,8],
  ['B-08','08-07','Zapscape：KVM 逃逸到主機','https://thehackernews.com/2026/08/new-zapscape-kvm-flaw-could-let.html','B',6,8,7,9],
  ['B-09','08-06','ClickFix 演進：瀏覽器指紋辨識後才給誘餌','https://thehackernews.com/2026/08/over-250-clickfix-domains-use-browser.html','B',8,8,8,7],
  ['B-10','08-04','DOUBLECUP：ClickFix＋快取 PNG 藏毒','https://thehackernews.com/2026/08/doublecup-uses-clickfix-and-cached-pngs.html','B',7,8,7,7],
  ['B-11','08-01','飯店 Wi-Fi 假更新→CornFlake 監控 RAT','https://thehackernews.com/2026/08/hijacked-hotel-wi-fi-pushes-fake.html','B',7,7,7,7],
  ['B-12','08-01','Adform JS 投毒：置換加密錢包位址','https://thehackernews.com/2026/08/hackers-poison-adform-script-to-swap.html','B',8,8,8,8],
  ['B-13','07-30','俄羅斯駭客 OWA：憑證輪換後持續存取','https://thehackernews.com/2026/07/russian-hackers-exploit-microsoft-owa.html','B',8,8,7,8],
  ['B-14','07-30','AnySign4PC：入侵受信任網站供應鏈投毒','https://thehackernews.com/2026/07/hackers-exploit-anysign4pc-via-hacked.html','B',8,8,8,8],
  ['B-15','07-31/08-05','裝置代碼釣魚＋Greatness PhaaS 繞 MFA','https://thehackernews.com/2026/08/greatness-phaas-adds-device-code.html','B',8,7,8,8],
  ['B-16','07-29','Flying Eagle Android RAT 原始碼外流 170 台','https://thehackernews.com/2026/07/flying-eagle-android-rat-traces-found.html','B',6,7,7,7],
  ['B-17','08-03','GHOSTBLADE：洩漏 DarkSword 工具包打 iOS','https://thehackernews.com/2026/08/chinese-threat-actor-uses-leaked.html','B',6,7,7,8],
  ['B-18','08-01','HollowFrame／Matryoshka：Go 載入器＋Rust 後門','https://thehackernews.com/2026/07/hollowframe-loader-deploys-matryoshka.html','B',6,7,7,7],
  ['B-19','07-30','SilverFox：三驅動 BYOVD→ValleyRAT','https://thehackernews.com/2026/07/silverfox-targets-japanese-manufacturer.html','B',6,8,7,8],
  ['B-20','07-27','Cruciferra：BYOVD＋進程重影','https://thehackernews.com/2026/07/cruciferra-crypter-uses-byovd-and.html','B',6,8,7,7],
  ['B-21','07-27','TELESHIM：Telegram 當 C2','https://thehackernews.com/2026/07/teleshim-abuses-telegram-for-c2-in.html','B',6,7,8,7],
  ['B-22','07-28','Nimbus Manticore：NightLedger 受害中繼','https://thehackernews.com/2026/07/nimbus-manticore-deploys-nightledger.html','B',6,7,7,7],
  ['B-23','07-29','CryptoJS 弱 RNG→570 萬美元流失','https://thehackernews.com/2026/08/cryptojs-weak-rng-behind-57-million-in.html','B',7,7,6,7],
  ['B-24','08-05','Kali365：把合法 Microsoft 登入變資料網關','https://thehackernews.com/2026/08/kali365-weaponizes-microsoft.html','B',7,8,7,7],
  ['B-25','07-31','中文駭客用 Telegram 指揮 DeepSeek 自主攻擊','https://thehackernews.com/2026/07/chinese-hacker-commands-deepseek-via.html','B',7,9,6,8],
  ['B-26','07-29','OpenAI 流氓代理入侵 Hugging Face 生產環境','https://thehackernews.com/2026/07/openai-agent-used-exposed-credentials.html','B',7,8,6,8],
  ['B-27','07-31','Claude 把開放網路當 CTF，入侵 3 組織','https://thehackernews.com/2026/07/anthropic-says-claude-mistook-open.html','B',7,8,6,8],
  ['B-28','08-05','Claude Mythos 5 試圖後門開源專案並自我辯護','https://thehackernews.com/2026/08/claude-mythos-5-tried-to-backdoor-real.html','B',7,9,6,8],
  ['B-29','07-28','OpenAI 模型利用 Artifactory 零日','https://thehackernews.com/2026/07/jfrog-confirms-openai-models-exploited.html','B',8,8,7,8],
  ['B-30','07-28','AI 輔助開發 Linux root 利用（tc 競態）','https://thehackernews.com/2026/07/researcher-says-ai-helped-develop-linux.html','B',6,8,6,8],
  ['B-31','08-07','HTTP Terminator：AI 發現新型 HTTP 去同步＋Apache 零日','https://thehackernews.com/2026/08/ai-assisted-http-terminator-finds-novel.html','B',8,10,7,8],
  ['B-32','07-29','Claude 破解後量子 HAWK-256、加速 AES','https://thehackernews.com/2026/07/claude-ai-just-cracked-post-quantum.html','B',7,9,6,8],
  ['B-33','08-06','AI 推薦中毒：「Ask AI」按鈕改寫 LLM 記憶','https://thehackernews.com/2026/08/ai-recommendation-poisoning-how-ask-ai.html','B',7,9,7,7],
  ['B-34','07-30','Copilot for Word 隱藏提示複製到新文件','https://thehackernews.com/2026/07/microsoft-copilot-for-word-can-copy.html','B',6,8,7,6],
  ['B-35','08-04','Google ADK：GitHub Issue 觸發特權代理','https://thehackernews.com/2026/08/google-deletes-3-adk-ai-workflows-after.html','B',7,8,7,8],
  ['B-36','08-07','Claude Code／Gemini CLI：Issue→CI 秘密外洩','https://thehackernews.com/2026/08/claude-code-and-gemini-cli-flaws-let.html','B',8,8,7,8],
  ['B-37','08-06','AWS／Google／Vercel 代理缺陷：指令直達工具','https://thehackernews.com/2026/08/aws-google-and-vercel-patch-agent-flaws.html','B',8,7,7,8],
  ['B-38','08-08','Atlassian Rovo 被騙外洩 Jira／Confluence 資料','https://thehackernews.com/2026/08/atlassian-rovo-can-be-tricked-into.html','B',8,7,7,7],
  ['B-39','07-29','Ruflo MCP 免認證 RCE','https://thehackernews.com/2026/07/ruflo-mcp-flaw-lets-unauthenticated.html','B',7,8,9,8],
  ['B-40','08-05','Paperclip AI 代理控制平面：匯入即 RCE','https://thehackernews.com/2026/08/paperclip-ai-flaws-let-attackers-run.html','B',7,8,8,8],
  ['B-41','08-03','Hugging Face Diffusers：模型儲存庫 RCE','https://thehackernews.com/2026/08/hugging-face-diffusers-flaws-could-let.html','B',8,7,8,8],
  ['B-42','08-05','Open VSX 77 個惡意雙胞胎擴充','https://thehackernews.com/2026/08/open-vsx-removes-77-malicious-evil-twin.html','B',8,7,8,7],
  ['B-43','08-05','QuickFox VPN 供應鏈攻擊→FDMTP 後門','https://thehackernews.com/2026/08/quickfox-supply-chain-attack-delivers.html','B',7,7,8,8],
  ['B-44','08-04','18 個 npm 套件鎖定阿里巴巴工具使用者','https://thehackernews.com/2026/08/18-malicious-npm-packages-deliver-cross.html','B',7,7,8,7],
  ['B-45','07-29','Joyfill npm 套件遭植入 RAT','https://thehackernews.com/2026/07/two-compromised-joyfill-npm-packages.html','B',7,7,8,7],
  ['B-46','08-01','OctLurk／SilkLurk 鎖定中亞政府','https://thehackernews.com/2026/08/suspected-chinese-speaking-hackers.html','B',6,8,7,7],
  ['B-47','08-07','TeamPCP：Redis 供應鏈攻擊可溯至 2020','https://thehackernews.com/2026/08/teampcp-linked-to-redis-attacks-dating.html','B',7,8,7,8],
  // ===== C 級（11） =====
  ['C-01','07-28','Arista VeloCloud 指令注入野外利用','https://thehackernews.com/2026/07/attackers-exploit-arista-velocloud.html','C',7,5,9,7],
  ['C-02','07-29','Check Point SmartConsole 認證繞過 PoC','https://thehackernews.com/2026/07/rapid7-releases-poc-for-exploited-check.html','C',6,5,8,7],
  ['C-03','07-30','Cisco FMC 零日：靜態憑證洩漏敏感資料','https://thehackernews.com/2026/07/cisco-fmc-zero-day-actively-exploited.html','C',6,5,8,7],
  ['C-04','08-08','Kemp LoadMaster 漏洞：792 次利用嘗試','https://thehackernews.com/2026/08/progress-kemp-loadmaster-flaw-hits-cisa.html','C',8,5,9,7],
  ['C-05','07-29','Tor 瀏覽器：單一惡意網頁即淪陷','https://thehackernews.com/2026/07/researchers-show-single-malicious.html','C',6,6,7,7],
  ['C-06','08-06','iCloud Private Relay 繞過暴露真實 IP','https://thehackernews.com/2026/08/webkit-proxy-bypasses-can-expose-real.html','C',6,6,7,6],
  ['C-07','08-07','Microsoft 365 AitM 釣魚鎖定財務郵件','https://thehackernews.com/2026/08/microsoft-365-aitm-phishing-hijacks.html','C',8,5,8,7],
  ['C-08','08-08','UNC6671 語音釣魚鎖定個人手機竊 SaaS','https://thehackernews.com/2026/08/unc6671-vishing-attacks-target-personal.html','C',6,6,7,7],
  ['C-09','07-31','北韓 macOS 惡意廣告：假更新竊加密貨幣','https://thehackernews.com/2026/07/dprk-linked-macos-malvertising-uses.html','C',6,5,7,7],
  ['C-10','08-08','ClickFix macOS 竊取器：掏空加密錢包','https://thehackernews.com/2026/08/clickfix-attacks-deliver-macos-stealer.html','C',7,6,7,7],
  ['C-11','07-27/08-04','假 Teams／Adobe／Zoom 更新→部署 RMM','https://thehackernews.com/2026/08/fake-adobe-and-zoom-updates-install.html','C',7,5,8,7],
];

const scored = articles.map(([id, date, title, url, tier, b, n, e, s]) => {
  const total = (b * W.b + n * W.n + e * W.e + s * W.s) / 10;
  return { id, date, title, url, tier, b, n, e, s, total: Math.round(total * 10) / 10 };
});

scored.sort((x, y) => y.total - x.total || x.id.localeCompare(y.id));

const band = t => (t >= 80 ? '🔥 優先' : t >= 70 ? '⚠️ 高' : '— 中');

let out = [];
out.push('# 資安新聞綜合評分排名 2026-07-27 ~ 08-08');
out.push('');
out.push(`> 從 119 篇篩出的 83 篇，依**綜合評分**重新排序（不再沿用 A/B/C 分級排序）。`);
out.push(`> 評分模型＝四維度各 1–10 分加權：**威脅廣度 ${W.b}%**（零日／野外利用／供應鏈規模／部署廣度）＋**技術巧思 ${W.n}%**（新攻擊類別／手法創新）＋**利用可及性 ${W.e}%**（公開 PoC／免認證／武器化門檻）＋**影響嚴重度 ${W.s}%**（CVSS／RCE/root／資料外洩深度）。總分 0–100。`);
out.push(`> 分數帶：**≥80＝優先處理**｜70–79.9＝高｜<70＝中。原分級（A/B/C）保留為參考欄位。`);
out.push('');

// 統計
const bands = { '🔥 優先': 0, '⚠️ 高': 0, '— 中': 0 };
for (const a of scored) bands[band(a.total)]++;
out.push(`**分數帶統計**：🔥 優先（≥80）**${bands['🔥 優先']} 篇**｜⚠️ 高（70–79.9）**${bands['⚠️ 高']} 篇**｜中（<70）**${bands['— 中']} 篇**`);
out.push('');

// Top 10
out.push('## 🏆 前十名（最高優先）');
out.push('');
out.push('| # | 分數 | 原分級 | 日期 | 標題 |');
out.push('|---|------|--------|------|------|');
scored.slice(0, 10).forEach((a, i) => {
  out.push(`| ${i + 1} | **${a.total}** | ${a.tier} | ${a.date} | [${a.title}](${a.url}) |`);
});
out.push('');

// 完整排名表
out.push('## 完整排名（83 篇）');
out.push('');
out.push('| 排名 | 總分 | 分數帶 | 原分級 | 日期 | 廣度 | 巧思 | 可及 | 嚴重 | 標題 |');
out.push('|------|------|--------|--------|------|------|------|------|------|------|');
scored.forEach((a, i) => {
  out.push(`| ${i + 1} | **${a.total}** | ${band(a.total)} | ${a.tier} | ${a.date} | ${a.b} | ${a.n} | ${a.e} | ${a.s} | [${a.title}](${a.url}) |`);
});
out.push('');
out.push('> 原分級彙整：`新聞精選（技術向）2026-08-10.md`｜原始 119 篇：`新聞彙整 2026-08-10.md`');
out.push('');

fs.writeFileSync('news_output/新聞精選（技術向）綜合評分 2026-08-10.md', out.join('\n'), 'utf8');
console.log(`已產生 ${scored.length} 篇（A:${scored.filter(a=>a.tier==='A').length} B:${scored.filter(a=>a.tier==='B').length} C:${scored.filter(a=>a.tier==='C').length}）`);
console.log('分數帶統計：', JSON.stringify(bands));
console.log('Top5:', scored.slice(0, 5).map(a => `${a.id}=${a.total}`).join(', '));
