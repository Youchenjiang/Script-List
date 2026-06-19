const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const baseDir = __dirname;
const indexPath = path.join(baseDir, "index.html");
const csvPath = path.join(baseDir, "submission_report.csv");

// 1. Fixed roster of all 42 enrolled students
const CLASS_LIST = [
    { id: "111453019", name: "魯國樑" },
    { id: "114453001", name: "黃奕鈞" },
    { id: "114453002", name: "鄭存濂" },
    { id: "114453003", name: "吳哲修" },
    { id: "114453004", name: "許耀中" },
    { id: "114453005", name: "李昆芳" },
    { id: "114453006", name: "簡佳豪" },
    { id: "114453007", name: "李賢懋" },
    { id: "114453008", name: "周文彬" },
    { id: "114453009", name: "黃志弘" },
    { id: "114453010", name: "劉政信" },
    { id: "114453011", name: "蔡芷若" },
    { id: "114453012", name: "陳寶壬" },
    { id: "114453013", name: "孫岳均" },
    { id: "114453014", name: "胡庭祥" },
    { id: "114453015", name: "陳韋仲" },
    { id: "114453016", name: "王昱晶" },
    { id: "114453017", name: "王佩玉" },
    { id: "114453018", name: "張安倫" },
    { id: "114453019", name: "郭天霖" },
    { id: "114453021", name: "吳明澔" },
    { id: "114453022", name: "巫正鍠" },
    { id: "114453023", name: "藍永翔" },
    { id: "114453024", name: "謝尚儒" },
    { id: "114453025", name: "張家鏵" },
    { id: "114453026", name: "李璦琳" },
    { id: "114453027", name: "張書倩" },
    { id: "114453028", name: "余汶儒" },
    { id: "114453029", name: "徐聖瑋" },
    { id: "114453031", name: "黃惠君" },
    { id: "114453032", name: "葉日威" },
    { id: "114453033", name: "張群嫄" },
    { id: "114453034", name: "黃淑穎" },
    { id: "114453035", name: "吳順棋" },
    { id: "114453036", name: "張丞玉" },
    { id: "114453039", name: "謝昕甫" },
    { id: "114453040", name: "方玟郁" },
    { id: "114453041", name: "巫彥儒" },
    { id: "114453046", name: "袁詔謙" },
    { id: "jayfung", name: "馮楚東" },
    { id: "Karin", name: "辛凱琳" },
    { id: "Roisin", name: "陳靜儀" }
];

// 2. Ensure pdf-parse is installed
try {
    require.resolve('pdf-parse');
} catch (e) {
    console.log("偵測到未安裝 pdf-parse，正在自動為您安裝，請稍候...");
    try {
        execSync('npm.cmd install pdf-parse', { cwd: baseDir, stdio: 'inherit' });
        console.log("pdf-parse 安裝成功！\n");
    } catch (err) {
        console.error("自動安裝失敗，請嘗試手動在終端機執行: npm install pdf-parse");
        process.exit(1);
    }
}

const { PDFParse } = require('pdf-parse');

// Parse index.html to find existing submissions
function parseIndex() {
    if (!fs.existsSync(indexPath)) {
        console.error(`找不到 index.html 檔案，請確認此腳本置於作業資料夾根目錄。`);
        process.exit(1);
    }
    const html = fs.readFileSync(indexPath, 'utf-8');
    const trRegex = /<tr id='list_tr\d+'[^>]*>([\s\S]*?)<\/tr>/g;
    let trMatch;
    const students = {};
    
    while ((trMatch = trRegex.exec(html)) !== null) {
        const trContent = trMatch[1];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
        let tdMatch;
        const tds = [];
        while ((tdMatch = tdRegex.exec(trContent)) !== null) {
            tds.push(tdMatch[1]);
        }
        if (tds.length < 6) continue;
        
        const id = tds[1].replace(/<[^>]*>/g, '').trim();
        const name = tds[2].replace(/<[^>]*>/g, '').trim();
        const titleTd = tds[3];
        const titleLinkMatch = titleTd.match(/href='([^']*)'/);
        const titleLink = titleLinkMatch ? titleLinkMatch[1] : '';
        const titleText = titleTd.replace(/<[^>]*>/g, '').trim();
        const late = tds[5].replace(/<[^>]*>/g, '').trim();
        
        students[name] = { id, name, title: titleText, localHtml: titleLink, late };
    }
    return students;
}

// Parse content.html for attachments
function parseContent(studentHtmlPath) {
    if (!fs.existsSync(studentHtmlPath)) {
        return { submitDate: '', articleText: '', attachments: [] };
    }
    const html = fs.readFileSync(studentHtmlPath, 'utf-8');
    
    let submitDate = '';
    const posterMatch = html.match(/<div class=poster>([\s\S]*?)<\/div>/);
    if (posterMatch) {
        const dateMatch = posterMatch[1].match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
        if (dateMatch) submitDate = dateMatch[0];
    }
    
    const attachments = [];
    const attachDivMatch = html.match(/<ul class='attachDiv'>([\s\S]*?)<\/ul>/);
    if (attachDivMatch) {
        const attachHtml = attachDivMatch[1];
        const liRegex = /<li>([\s\S]*?)<\/li>/g;
        let liMatch;
        while ((liMatch = liRegex.exec(attachHtml)) !== null) {
            const aMatch = liMatch[1].match(/<a href='([^']*)'[^>]*>([\s\S]*?)<\/a>/);
            if (aMatch) {
                const href = decodeURIComponent(aMatch[1]);
                const name = aMatch[2].replace(/<[^>]*>/g, '').trim();
                attachments.push({ href, name });
            }
        }
    }
    return { submitDate, attachments };
}

// Extract custom description from Option 3/4 filename
function getCustomDescription(fname, studentName, studentId) {
    const nameEscaped = studentName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let clean = fname;
    clean = clean.replace(/\.[^/.]+$/, ""); // strip extension
    clean = clean.replace(/\.\w+\s*$/, "");  // strip double extension
    
    const prefixRegex = new RegExp(`^(?:${nameEscaped}|${studentId})_+([選項]*)?[34其他三四]+_+`, 'i');
    if (prefixRegex.test(clean)) {
        return clean.replace(prefixRegex, "").trim();
    }
    
    // Fallback: split by _ or - and filter out name and id
    const parts = clean.split(/[_\-]+/);
    const cleanParts = parts.filter(p => p !== studentName && p !== studentId && p !== "選項三" && p !== "選項四" && p !== "3" && p !== "4" && p !== "其他" && p !== "其他＿");
    if (cleanParts.length > 0) {
        return cleanParts.join("_");
    }
    return clean;
}

// Detect Option Number
function detectOption(fname, studentName, studentId) {
    const nameEscaped = studentName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const optRegex = new RegExp(`^(?:${nameEscaped}|${studentId})_+(?:選項)?([1234五一二三四其他]+)_+`, 'i');
    const match = fname.match(optRegex);
    
    if (match) {
        const optRaw = match[1];
        if (optRaw === "1" || optRaw === "一") return 1;
        if (optRaw === "2" || optRaw === "二") return 2;
        if (optRaw === "3" || optRaw === "三") return 3;
        if (optRaw === "4" || optRaw === "四" || optRaw === "5" || optRaw === "五" || optRaw === "其他") return 4;
    }
    
    // Guess fallback
    const lower = fname.toLowerCase();
    if (lower.includes("introduction") || (lower.includes("cybersecurity") && !lower.includes("essential") && !lower.includes("analyst"))) {
        return 1;
    }
    if (lower.includes("essential") || lower.includes("analyst")) {
        return 2;
    }
    if (lower.includes("picoctf") || lower.includes("cdx")) {
        return 3;
    }
    return 4;
}

// Verify PDF text content
async function verifyPDF(filePath, expectedOption) {
    if (!fs.existsSync(filePath)) {
        return { ok: false, desc: "檔案不存在" };
    }
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const p = new PDFParse(new Uint8Array(dataBuffer));
        const data = await p.getText();
        const text = data.text;
        const lowerText = text.toLowerCase();
        
        let certOwner = "未知";
        const awardRegex = /(?:awarded to|this certificate is presented to)\s*\n*([^\n\r]+)/i;
        const awardMatch = text.match(awardRegex);
        if (awardMatch) {
            certOwner = awardMatch[1].trim();
        } else {
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes("awarded to") && i + 1 < lines.length) {
                    certOwner = lines[i+1].trim();
                    break;
                }
            }
        }
        
        if (expectedOption === 1) {
            if (lowerText.includes("introduction to cybersecurity")) {
                return { ok: true, desc: "v", owner: certOwner, course: "Introduction to Cybersecurity" };
            }
            if (lowerText.includes("cybersecurity essentials") || lowerText.includes("cyber security essential")) {
                return { ok: false, desc: "實為 Cybersecurity Essentials 證書", owner: certOwner, course: "Cybersecurity Essentials" };
            }
            return { ok: true, desc: "v", owner: certOwner, course: "Introduction to Cybersecurity" };
        } else if (expectedOption === 2) {
            if (lowerText.includes("cybersecurity essentials") || lowerText.includes("cyber security essential")) {
                return { ok: true, desc: "v", owner: certOwner, course: "Cybersecurity Essentials" };
            }
            if (lowerText.includes("junior cybersecurity analyst") || lowerText.includes("career path")) {
                return { ok: true, desc: "v (Junior Cybersecurity Analyst Career Path)", owner: certOwner, course: "Junior Cybersecurity Analyst" };
            }
            if (lowerText.includes("introduction to cybersecurity")) {
                return { ok: false, desc: "實為 Introduction to Cybersecurity 證書", owner: certOwner, course: "Introduction to Cybersecurity" };
            }
            return { ok: true, desc: "v", owner: certOwner, course: "Cybersecurity Essentials" };
        }
        return { ok: true, desc: "v", owner: certOwner };
    } catch (e) {
        return { ok: false, desc: `PDF解析錯誤: ${e.message}` };
    }
}

async function run() {
    console.log("開始進行作業繳交狀況統計...");
    const submittedMap = parseIndex();
    const dirs = fs.readdirSync(baseDir).filter(f => fs.statSync(path.join(baseDir, f)).isDirectory());
    
    const csvRows = [
        ["學號", "姓名", "選項1 (Intro)", "選項2 (Essential)", "選項3 (PicoCTF/CDX)", "選項4 (其他加分)"]
    ];
    
    for (const student of CLASS_LIST) {
        const s = submittedMap[student.name];
        
        if (!s) {
            const matchedFolder = dirs.find(d => d.includes(`(${student.name})`));
            if (!matchedFolder) {
                csvRows.push([student.id, student.name, "", "", "", ""]);
                continue;
            }
        }
        
        const matchedFolder = dirs.find(d => d.includes(`(${student.name})`));
        const studentDir = path.join(baseDir, matchedFolder);
        const htmlPath = path.join(studentDir, "content.html");
        const details = parseContent(htmlPath);
        
        let opt1Cell = "";
        let opt2Cell = "";
        let opt3Cell = "";
        let opt4Cell = "";
        
        for (const att of details.attachments) {
            const attPath = path.resolve(studentDir, att.href);
            const ext = path.extname(att.name).toLowerCase();
            const option = detectOption(att.name, student.name, student.id);
            
            let statusDesc = "v";
            
            if (option === 1 || option === 2) {
                if (ext === ".pdf") {
                    const check = await verifyPDF(attPath, option);
                    statusDesc = check.desc;
                } else if (ext === ".png" || ext === ".jpg" || ext === ".jpeg") {
                    statusDesc = "v (圖片/截圖)";
                } else {
                    statusDesc = `v (${ext.substring(1).toUpperCase()})`;
                }
            } else {
                // Option 3 and 4: Extract what they submitted and identify file type
                const description = getCustomDescription(att.name, student.name, student.id);
                const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);
                const typeLabel = isImage ? "僅結果圖" : "詳細文件";
                statusDesc = `v (${description} - ${typeLabel})`;
            }
            
            if (option === 1) {
                opt1Cell = opt1Cell ? opt1Cell + " | " + statusDesc : statusDesc;
            } else if (option === 2) {
                opt2Cell = opt2Cell ? opt2Cell + " | " + statusDesc : statusDesc;
            } else if (option === 3) {
                opt3Cell = opt3Cell ? opt3Cell + " | " + statusDesc : statusDesc;
            } else if (option === 4) {
                opt4Cell = opt4Cell ? opt4Cell + " | " + statusDesc : statusDesc;
            }
        }
        
        csvRows.push([
            student.id, 
            student.name, 
            opt1Cell, 
            opt2Cell, 
            opt3Cell, 
            opt4Cell
        ]);
    }
    
    // Convert to CSV string (with BOM for Excel Chinese compatibility)
    const csvContent = "\uFEFF" + csvRows.map(row => 
        row.map(cell => {
            let val = cell.replace(/"/g, '""');
            if (val.includes(",") || val.includes("\n") || val.includes('"')) {
                return `"${val}"`;
            }
            return val;
        }).join(",")
    ).join("\n");
    
    fs.writeFileSync(csvPath, csvContent, "utf-8");
    console.log(`\n統計完成！`);
    console.log(`CSV 報告已生成於: ${csvPath}`);
    console.log(`全體 42 名學生統計結果已寫入。請在 6/20 取得最終繳交檔案後直接執行: node run_report.js`);
}

run();
