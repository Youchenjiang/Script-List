/**
 * CyLab Security Academy Learning Paths & Topics Multi-Page Exporter
 * 
 * Instructions:
 * 1. Open and log in to https://learn.cylabacademy.org/learning-paths?page=1
 * 2. Press F12 to open Developer Tools and select the "Console" tab.
 * 3. Copy and paste this script into the Console and press Enter.
 *    (Ensure popup windows are allowed for this site if prompted).
 * 4. The script scans ALL pages (page=1, page=2, page=3...) to gather ALL Learning Path links,
 *    opens popup windows to render each page, extracts React DOM topics, formats clickable
 *    Markdown links [Title](https://learn.cylabacademy.org/learning-paths/ID), and downloads
 *    a CyLab_All_Learning_Paths_and_Topics_YYYY-MM-DD.md file.
 */

(async function crawlAllPagesLearningPaths() {
    console.log("🚀 Starting multi-page scan for all Learning Paths & Topics with Clickable Links...");

    let allUniqueHrefs = [];
    let page = 1;
    let hasMorePages = true;

    // Phase 1: Multi-page scan to collect all Learning Path URLs
    while (hasMorePages) {
        console.log(`Scanning list page ${page}...`);
        try {
            let res = await fetch(`/api/learning-paths/?page=${page}&page_size=100`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) res = await fetch(`/api/v1/learning-paths/?page=${page}&page_size=100`);

            if (res.ok) {
                const data = await res.json();
                const results = data.results || data.learning_paths || [];
                if (results.length === 0) {
                    hasMorePages = false;
                } else {
                    results.forEach(item => {
                        const id = item.id || item.slug;
                        if (id) allUniqueHrefs.push(`/learning-paths/${id}`);
                    });
                    if (!data.next) hasMorePages = false;
                    else page++;
                }
            } else {
                const pageUrl = `/learning-paths?page=${page}`;
                const htmlRes = await fetch(pageUrl);
                if (htmlRes.ok) {
                    const htmlText = await htmlRes.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');
                    const links = Array.from(doc.querySelectorAll('a[href*="/learning-paths/"]'));
                    const pageHrefs = [...new Set(links.map(a => a.getAttribute('href')))]
                        .filter(href => href !== '/learning-paths' && href !== '/learning-paths/');

                    const newHrefs = pageHrefs.filter(h => !allUniqueHrefs.includes(h));
                    if (newHrefs.length === 0) {
                        hasMorePages = false;
                    } else {
                        allUniqueHrefs.push(...newHrefs);
                        console.log(`Page ${page}: found ${newHrefs.length} new links`);
                        page++;
                    }
                } else {
                    hasMorePages = false;
                }
            }
        } catch (e) {
            console.error(`Error scanning page ${page}:`, e);
            hasMorePages = false;
        }
    }

    allUniqueHrefs = [...new Set(allUniqueHrefs)];
    console.log(`🎉 Finished multi-page list scan! Found ${allUniqueHrefs.length} total Learning Paths:`, allUniqueHrefs);

    if (allUniqueHrefs.length === 0) {
        alert("⚠️ No Learning Path links found!");
        return;
    }

    // Phase 2: Popup crawler for detail topics with Markdown links
    let finalMarkdown = `# CyLab Security Academy - All Learning Paths & Topics Overview\n\n`;
    finalMarkdown += `*Total Learning Paths: ${allUniqueHrefs.length}*\n`;
    finalMarkdown += `*Exported At: ${new Date().toLocaleString()}*\n\n---\n\n`;

    for (let i = 0; i < allUniqueHrefs.length; i++) {
        const href = allUniqueHrefs[i];
        const fullUrl = href.startsWith('http') ? href : window.location.origin + href;
        console.log(`[${i + 1}/${allUniqueHrefs.length}] Opening popup to render: ${fullUrl}`);

        const win = window.open(fullUrl, '_blank', 'width=900,height=700');
        if (!win) {
            alert("⚠️ Browser blocked popups! Please allow popup windows for this site in the address bar and re-run.");
            return;
        }

        await new Promise(r => setTimeout(r, 2200));

        try {
            const doc = win.document;

            const rawTitle = doc.querySelector('h1, h2, [class*="title"]')?.innerText?.trim() || `Learning Path (${href})`;
            const description = doc.querySelector('[class*="description"], [class*="subtitle"], p')?.innerText?.trim() || '';

            // Format clickable Markdown link for Learning Path Header
            const headerLink = `[${rawTitle}](${fullUrl})`;

            const topicNodes = doc.querySelectorAll('h2, h3, h4, [class*="topic"], [class*="module"], [class*="section"], [class*="chapter"], [class*="card"], a[href*="challenge"], a[href*="course"]');
            let topics = [];
            topicNodes.forEach(node => {
                const text = node.innerText?.trim();
                const linkHref = node.getAttribute('href') || node.querySelector('a')?.getAttribute('href');
                if (text && text.length > 2 && text.length < 150 && text !== rawTitle && !text.includes('CyLab') && !text.includes('Copyright')) {
                    if (linkHref) {
                        const fullTopicUrl = linkHref.startsWith('http') ? linkHref : window.location.origin + linkHref;
                        const formatted = `[${text}](${fullTopicUrl})`;
                        if (!topics.includes(formatted)) topics.push(formatted);
                    } else {
                        if (!topics.includes(text)) topics.push(text);
                    }
                }
            });

            finalMarkdown += `## ${i + 1}. ${headerLink}\n`;
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

    console.log("%c🎉 Successfully exported all Learning Paths & Topics with clickable links!", "color: #00ff00; font-weight: bold; font-size: 14px;");

    const blob = new Blob([finalMarkdown], { type: 'text/markdown;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CyLab_All_Learning_Paths_and_Topics_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    try {
        await navigator.clipboard.writeText(finalMarkdown);
        console.log("📋 Exported Markdown copied to clipboard!");
    } catch (e) {}
})();
