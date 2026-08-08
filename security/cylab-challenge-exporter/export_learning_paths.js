/**
 * CyLab Security Academy Learning Paths & Topics Exporter
 * 
 * Instructions:
 * 1. Open and log in to https://learn.cylabacademy.org/learning-paths?page=1
 * 2. Press F12 to open Developer Tools and select the "Console" tab.
 * 3. Copy and paste this script into the Console and press Enter.
 *    (Ensure pop-up windows are allowed for this site if prompted).
 * 4. The script uses同源 Popup windows to bypass X-Frame-Options, loads each 
 *    Learning Path detail page, extracts rendered React DOM topics, and downloads
 *    a CyLab_Learning_Paths_and_Topics_YYYY-MM-DD.md file.
 */

(async function crawlViaPopups() {
    console.log("🚀 Starting CyLab Learning Paths & Topics Exporter...");

    const links = Array.from(document.querySelectorAll('a[href*="/learning-paths/"]'));
    const uniqueHrefs = [...new Set(links.map(a => a.getAttribute('href')))]
        .filter(href => href !== '/learning-paths' && href !== '/learning-paths/');

    console.log(`📌 Found ${uniqueHrefs.length} Learning Path links:`, uniqueHrefs);

    let finalMarkdown = `# CyLab Security Academy - Learning Paths & Topics Overview\n\n`;
    finalMarkdown += `*Exported At: ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (let i = 0; i < uniqueHrefs.length; i++) {
        const href = uniqueHrefs[i];
        const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
        console.log(`[${i + 1}/${uniqueHrefs.length}] Opening popup to render: ${fullUrl}`);

        const win = window.open(fullUrl, '_blank', 'width=900,height=700');
        if (!win) {
            alert("⚠️ Browser blocked popups! Please allow popup windows for this site in the address bar and re-run.");
            return;
        }

        // Wait 2.2 seconds for React client-side rendering
        await new Promise(r => setTimeout(r, 2200));

        try {
            const doc = win.document;

            const title = doc.querySelector('h1, h2, [class*="title"]')?.innerText?.trim() || `Learning Path (${href})`;
            const description = doc.querySelector('[class*="description"], [class*="subtitle"], p')?.innerText?.trim() || '';

            const topicNodes = doc.querySelectorAll('h2, h3, h4, [class*="topic"], [class*="module"], [class*="section"], [class*="chapter"], [class*="card"], li');
            let topics = [];
            topicNodes.forEach(node => {
                const text = node.innerText?.trim();
                if (text && text.length > 2 && text.length < 150 && text !== title && !topics.includes(text) && !text.includes('CyLab') && !text.includes('Copyright')) {
                    topics.push(text);
                }
            });

            finalMarkdown += `## ${i + 1}. ${title}\n`;
            if (description) finalMarkdown += `> ${description}\n\n`;

            if (topics.length > 0) {
                finalMarkdown += `### 📌 Topics / Modules:\n`;
                topics.forEach((t, idx) => {
                    finalMarkdown += `${idx + 1}. ${t}\n`;
                });
            } else {
                const bodyPreview = doc.body.innerText.split('\n').filter(line => line.trim().length > 3).slice(0, 15).join('\n- ');
                finalMarkdown += `### 📌 Content Summary:\n- ${bodyPreview}\n`;
            }

            finalMarkdown += `\n---\n\n`;
        } catch (err) {
            console.error(`Failed to capture page ${fullUrl}:`, err);
        } finally {
            win.close();
        }
    }

    console.log("%c🎉 Successfully exported all Learning Paths & Topics!", "color: #00ff00; font-weight: bold; font-size: 14px;");
    console.log(finalMarkdown);

    const blob = new Blob([finalMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CyLab_Learning_Paths_and_Topics_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    try {
        await navigator.clipboard.writeText(finalMarkdown);
        console.log("📋 Exported Markdown copied to clipboard!");
    } catch (e) {}
})();
