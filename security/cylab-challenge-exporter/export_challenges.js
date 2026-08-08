/**
 * CyLab Security Academy / picoCTF Challenge Exporter
 * 
 * Instructions:
 * 1. Open and log in to https://learn.cylabacademy.org/library
 * 2. Press F12 to open Developer Tools and click the "Console" tab.
 * 3. Copy and paste this script into the Console and press Enter.
 * 4. It will automatically fetch all challenge pages using your active session
 *    and download a CyLab_All_Challenges_YYYY-MM-DD.csv and .json file.
 */

(async function exportCyLabChallenges() {
    console.log("🚀 Starting CyLab Security Academy challenge export...");
    
    let allChallenges = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        console.log(`Fetching page ${page}...`);
        try {
            const res = await fetch(`/api/challenges/?page=${page}&page_size=100`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!res.ok) {
                console.warn(`Page ${page} request failed (Status ${res.status})`);
                break;
            }

            const data = await res.json();
            const results = data.results || [];

            if (results.length === 0) {
                hasMore = false;
            } else {
                allChallenges.push(...results);
                console.log(`✅ Page ${page}: fetched ${results.length} challenges (total: ${allChallenges.length})`);
                
                if (!data.next && results.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        } catch (err) {
            console.error("Error during fetch:", err);
            hasMore = false;
        }
    }

    console.log(`🎉 Finished fetching all pages! Total challenges: ${allChallenges.length}`);

    if (allChallenges.length === 0) {
        alert("⚠️ No challenges found! Please ensure you are logged in and page is loaded.");
        return;
    }

    const safeStr = (val) => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return val.name || val.title || JSON.stringify(val);
        return String(val);
    };

    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Export JSON (for process_challenges.py)
    const jsonBlob = new Blob([JSON.stringify(allChallenges, null, 2)], { type: 'application/json' });
    const jsonLink = document.createElement('a');
    jsonLink.href = URL.createObjectURL(jsonBlob);
    jsonLink.download = `cylab_challenges_${dateStr}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);

    // 2. Export CSV (with UTF-8 BOM for Excel compatibility)
    let csvContent = "\uFEFFID,Name,Category,Difficulty,Points,Author,Users Solved,Status,Event\n";
    allChallenges.forEach(item => {
        const id = item.id || '';
        const name = `"${safeStr(item.name).replace(/"/g, '""')}"`;
        const category = `"${safeStr(item.category?.name || item.category).replace(/"/g, '""')}"`;
        const difficulty = item.difficulty ?? '';
        const points = item.event_points ?? item.points ?? 0;
        const author = `"${safeStr(item.author).replace(/"/g, '""')}"`;
        const usersSolved = item.users_solved ?? 0;
        const solvedState = item.solved_by_user ? "Solved" : "Unsolved";
        const eventName = `"${safeStr(item.event?.name || item.event).replace(/"/g, '""')}"`;

        csvContent += `${id},${name},${category},${difficulty},${points},${author},${usersSolved},${solvedState},${eventName}\n`;
    });

    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvLink = document.createElement('a');
    csvLink.href = URL.createObjectURL(csvBlob);
    csvLink.download = `CyLab_Challenges_${dateStr}.csv`;
    document.body.appendChild(csvLink);
    csvLink.click();
    document.body.removeChild(csvLink);

    console.log("📁 Both JSON and CSV files downloaded successfully!");
})();
