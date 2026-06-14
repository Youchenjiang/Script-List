/**
 * GitHub Star Lists Sync Utility (GraphQL version)
 * 
 * This script automatically parses repository links and their corresponding categories
 * (markdown headings) from README.zh-TW.md, and uses the GitHub GraphQL API to:
 *   1. Fetch existing custom Star Lists.
 *   2. Create any missing Star Lists that match your categories.
 *   3. Retrieve the GraphQL IDs and existing list memberships of repositories in batches.
 *   4. Sync each repository to its corresponding custom Star List without losing other list associations.
 *   5. Clean up any empty incorrectly named lists.
 * 
 * Usage:
 *   node sync-github-stars.js [options]
 * 
 * Options:
 *   --sync     Directly synchronize repositories to custom lists without showing a menu.
 *   --check    Directly check status without showing a menu.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgCyan: '\x1b[36m',
  fgMagenta: '\x1b[35m',
};

// Adjusted path to go one folder deeper (../../../)
const defaultMarkdownPath = path.resolve(__dirname, '../../../Method-List/resources/github/README.zh-TW.md');

// Mapping to shorten main (parent) categories for list names
const parentCategoryMapping = {
  'AI 智慧代理與 LLM 工作流工具': 'AI',
  '資訊安全、逆向工程與開源情報': '資安',
  '文檔智能與視覺 GUI 解析': '文檔GUI',
  '語音、音訊與影片 AI': '影音AI',
  '深度學習基礎與量化金融': 'DL/金融',
  '開發者工具與系統生產力': '開發工具'
};

function parseRepoUrl(url) {
  try {
    const cleanUrl = url.split('#')[0].split('?')[0];
    const parsed = new URL(cleanUrl);
    
    if (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com') {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        let repo = pathParts[1];
        if (repo.endsWith('.git')) {
          repo = repo.slice(0, -4);
        }
        return `${owner}/${repo}`;
      }
    }
  } catch (e) {
    // Ignore invalid URLs
  }
  return null;
}

// Parses categories and repositories recursively, tracking parent (##) and sub (###) headings
// Added isSubFile parameter to avoid overriding categories when parsing linked sub-markdown files
function parseCategoriesAndRepos(filePath, processedFiles = new Set(), inheritedParent = null, inheritedSub = null, isSubFile = false) {
  const normalizedPath = path.resolve(filePath);
  if (processedFiles.has(normalizedPath)) return [];
  processedFiles.add(normalizedPath);

  if (!fs.existsSync(normalizedPath)) {
    console.warn(`${colors.fgYellow}Warning: File not found: ${normalizedPath}${colors.reset}`);
    return [];
  }

  const content = fs.readFileSync(normalizedPath, 'utf8');
  const lines = content.split(/\r?\n/);
  
  let currentParent = inheritedParent || '';
  let currentSub = inheritedSub || '';
  const results = [];

  function getListName(parent, sub) {
    if (!parent) return sub || 'General';
    const shortParent = parentCategoryMapping[parent] || parent.substring(0, 6);
    if (!sub) return `[${shortParent}]`;
    return `[${shortParent}] ${sub}`;
  }

  for (let line of lines) {
    line = line.trim();
    
    // Check for headings - ONLY if we are parsing the main file (not detailed sub-markdown pages)
    if (!isSubFile && line.startsWith('#')) {
      const headingMatch = line.match(/^(#+)\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        let name = headingMatch[2].trim();
        name = name.replace(/[\*\_]+/g, '').trim();
        
        if (name && name !== 'GitHub 參考清單') {
          if (level === 2) {
            currentParent = name;
            currentSub = ''; // Reset sub-category for new parent
          } else if (level === 3) {
            currentSub = name;
          }
        }
      }
    }

    // Match markdown links
    const globalLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = globalLinkRegex.exec(line)) !== null) {
      const url = match[2].trim();
      if (url.includes('github.com')) {
        const parsed = parseRepoUrl(url);
        if (parsed) {
          const listName = getListName(currentParent, currentSub);
          results.push({ repo: parsed, category: listName });
        }
      } else if (url.endsWith('.md') && !url.startsWith('http')) {
        // Local markdown file reference
        const localPath = path.resolve(path.dirname(normalizedPath), url);
        // Pass isSubFile = true so that subheadings in the referenced file are ignored
        const subResults = parseCategoriesAndRepos(localPath, processedFiles, currentParent, currentSub, true);
        results.push(...subResults);
      }
    }
  }

  return results;
}

// Helper to make GraphQL calls
async function graphqlRequest(query, variables, token) {
  const url = 'https://api.github.com/graphql';
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'User-Agent': 'Node-GitHub-Star-Sync-Tool',
    'Content-Type': 'application/json'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });
    
    const body = await response.json();
    return body;
  } catch (error) {
    return {
      errors: [{ message: error.message }]
    };
  }
}

// Fetches existing custom star lists from the user and their items
async function fetchUserLists(token) {
  const query = `
    query {
      viewer {
        lists(first: 100) {
          nodes {
            id
            name
            items(first: 100) {
              nodes {
                ... on Repository {
                  id
                  nameWithOwner
                }
              }
            }
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query, {}, token);
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.viewer.lists.nodes || [];
}

// Creates a new user list (Star List) on GitHub
async function createUserList(name, token) {
  const mutation = `
    mutation($name: String!) {
      createUserList(input: {name: $name}) {
        list {
          id
          name
        }
      }
    }
  `;
  const result = await graphqlRequest(mutation, { name }, token);
  if (result.errors) {
    throw new Error(`Failed to create list "${name}": ${result.errors[0].message}`);
  }
  return result.data.createUserList.list;
}

// Updates list memberships for a repository
async function updateRepoLists(itemId, listIds, token) {
  const mutation = `
    mutation($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: {itemId: $itemId, listIds: $listIds}) {
        lists {
          name
          id
        }
      }
    }
  `;
  const result = await graphqlRequest(mutation, { itemId, listIds }, token);
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
  return result.data.updateUserListsForItem.lists;
}

// Deletes a user list on GitHub
async function deleteUserList(id, token) {
  const mutation = `
    mutation($id: ID!) {
      deleteUserList(input: {id: $id}) {
        clientMutationId
      }
    }
  `;
  const result = await graphqlRequest(mutation, { id }, token);
  if (result.errors) {
    throw new Error(result.errors[0].message);
  }
}

// core function performing check or sync
async function performAction(isSyncing, token, categories, userLists, repoList, repoToCategories, repoToCurrentLists) {
  // Stage 1: Ensure Star Lists exist (Only if syncing)
  const listNameToId = {};
  for (const list of userLists) {
    listNameToId[list.name] = list.id;
  }

  if (isSyncing) {
    console.log(`\nEnsuring all ${categories.size} categories exist as Star Lists on GitHub...`);
    for (const category of categories) {
      if (!listNameToId[category]) {
        process.stdout.write(`Creating list "${category}"... `);
        try {
          const newList = await createUserList(category, token);
          listNameToId[category] = newList.id;
          console.log(`${colors.fgGreen}Created (${newList.id})${colors.reset}`);
        } catch (err) {
          console.log(`${colors.fgRed}Failed: ${err.message}${colors.reset}`);
        }
      } else {
        console.log(`List "${category}" already exists.`);
      }
    }
  }

  // Stage 2: Batch-fetch repository node IDs
  console.log(`\nFetching repository IDs from GitHub...`);
  const repoDetails = {};
  const batchSize = 20;

  for (let i = 0; i < repoList.length; i += batchSize) {
    const batch = repoList.slice(i, i + batchSize);
    console.log(`Fetching batch [${i + 1}-${Math.min(i + batchSize, repoList.length)} of ${repoList.length}]...`);
    
    const queryParts = batch.map((repoStr, index) => {
      const [owner, name] = repoStr.split('/');
      const alias = `repo_${index}`;
      return `${alias}: repository(owner: "${owner}", name: "${name}") { id }`;
    });
    const batchQuery = `query { ${queryParts.join('\n')} }`;
    
    const res = await graphqlRequest(batchQuery, {}, token);
    if (res.errors) {
      console.warn(`${colors.fgYellow}Warnings in batch query:${colors.reset}`);
      for (const err of res.errors) {
        console.warn(` - ${err.message}`);
      }
    }

    if (res.data) {
      batch.forEach((repoStr, index) => {
        const alias = `repo_${index}`;
        const dataObj = res.data[alias];
        if (dataObj) {
          repoDetails[repoStr] = {
            id: dataObj.id
          };
        } else {
          repoDetails[repoStr] = null;
        }
      });
    }
    await new Promise(r => setTimeout(r, 100)); // Sleep between batch requests
  }

  // Stage 3: Perform check or update
  console.log(`\n${isSyncing ? 'Syncing' : 'Checking'} memberships...`);
  let upToDateCount = 0;
  let updatedCount = 0;
  let missingRepoCount = 0;
  let errorCount = 0;

  for (let i = 0; i < repoList.length; i++) {
    const repo = repoList[i];
    const details = repoDetails[repo];
    const targetCategories = Array.from(repoToCategories[repo]);

    if (!details) {
      console.log(`[${i + 1}/${repoList.length}] ${colors.fgRed}✗ Repository "${repo}" not found or inaccessible.${colors.reset}`);
      missingRepoCount++;
      continue;
    }

    // Find which target list IDs this repo needs to belong to
    const requiredListIds = targetCategories.map(cat => listNameToId[cat]).filter(Boolean);
    
    // Retrieve current list IDs from our mapping
    const currentListSet = repoToCurrentLists[repo.toLowerCase()] || new Set();
    const currentListIds = Array.from(currentListSet);

    // Check if repo already belongs to all target categories
    const missingListIds = requiredListIds.filter(id => !currentListIds.includes(id));

    if (missingListIds.length === 0) {
      console.log(`[${i + 1}/${repoList.length}] ${colors.fgGreen}✓ ${repo}${colors.reset} is already in: ${targetCategories.join(', ')}`);
      upToDateCount++;
    } else {
      const actionText = isSyncing ? 'Adding to' : 'Missing from';
      console.log(`[${i + 1}/${repoList.length}] ${colors.fgYellow}! ${repo}${colors.reset} is ${actionText}: ${targetCategories.join(', ')}`);
      
      if (isSyncing) {
        // Merge existing list memberships with the new ones
        const mergedListIds = Array.from(new Set([...currentListIds, ...requiredListIds]));
        
        try {
          await updateRepoLists(details.id, mergedListIds, token);
          console.log(`      ${colors.fgGreen}→ Successfully updated!${colors.reset}`);
          updatedCount++;
          
          // Update local mapping cache
          if (!repoToCurrentLists[repo.toLowerCase()]) {
            repoToCurrentLists[repo.toLowerCase()] = new Set();
          }
          for (const lid of requiredListIds) {
            repoToCurrentLists[repo.toLowerCase()].add(lid);
          }
        } catch (err) {
          console.log(`      ${colors.fgRed}→ Failed to update: ${err.message}${colors.reset}`);
          errorCount++;
        }
        await new Promise(r => setTimeout(r, 150));
      } else {
        updatedCount++; // Track as needing updates
      }
    }
  }

  console.log(`\n${colors.bright}Run Summary:${colors.reset}`);
  console.log(`- Up to date: ${colors.fgGreen}${upToDateCount}${colors.reset}`);
  console.log(`- ${isSyncing ? 'Successfully Updated' : 'Need Syncing'}: ${colors.fgYellow}${updatedCount}${colors.reset}`);
  if (missingRepoCount > 0) {
    console.log(`- Repo not found/inaccessible: ${colors.fgRed}${missingRepoCount}${colors.reset}`);
  }
  if (errorCount > 0) {
    console.log(`- Errors: ${colors.fgRed}${errorCount}${colors.reset}`);
  }

  // Stage 4: Clean up any empty incorrect lists (Only if syncing)
  if (isSyncing) {
    console.log(`\nChecking for empty incorrect lists to clean up...`);
    const freshLists = await fetchUserLists(token);
    const allowedPrefixes = ['[AI] ', '[資安] ', '[文檔GUI] ', '[影音AI] ', '[DL/金融] ', '[開發工具] '];
    
    for (const list of freshLists) {
      const reposInList = list.items?.nodes || [];
      const isAllowed = allowedPrefixes.some(pref => list.name.startsWith(pref));
      
      // We only delete if it's empty AND doesn't start with our allowed prefixes
      if (reposInList.length === 0 && !isAllowed) {
        // Additionally check if it looks like one of the bad patterns (starts with [ or is a common subheader)
        const isBadName = list.name.startsWith('[') || ['使用', '安裝', '說明', 'Introd', 'Key Fe', 'How to', 'SDK Su'].some(bad => list.name.includes(bad));
        if (isBadName) {
          process.stdout.write(`Cleaning up empty incorrect list "${list.name}"... `);
          try {
            await deleteUserList(list.id, token);
            console.log(`${colors.fgGreen}Deleted successfully.${colors.reset}`);
          } catch (err) {
            console.log(`${colors.fgRed}Failed: ${err.message}${colors.reset}`);
          }
        }
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const autoSync = args.includes('--sync');
  const autoCheck = args.includes('--check');

  console.log(`${colors.bright}${colors.fgCyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.fgCyan}        GitHub Star Lists Sync Utility (GraphQL)     ${colors.reset}`);
  console.log(`${colors.bright}${colors.fgCyan}====================================================${colors.reset}\n`);

  console.log(`${colors.dim}Reading list from:${colors.reset} ${defaultMarkdownPath}`);
  
  if (!fs.existsSync(defaultMarkdownPath)) {
    console.error(`${colors.fgRed}Error: The target file README.zh-TW.md does not exist at expected path.${colors.reset}`);
    process.exit(1);
  }

  // Parse repo-category relations
  const parsedItems = parseCategoriesAndRepos(defaultMarkdownPath);
  
  // Group by repository to handle repositories that might appear multiple times
  const repoToCategories = {};
  const categories = new Set();

  for (const item of parsedItems) {
    if (!repoToCategories[item.repo]) {
      repoToCategories[item.repo] = new Set();
    }
    repoToCategories[item.repo].add(item.category);
    categories.add(item.category);
  }

  const repoList = Object.keys(repoToCategories).sort();

  console.log(`${colors.fgGreen}Success! Found ${colors.bright}${repoList.length}${colors.reset} unique repositories classified under ${colors.bright}${categories.size}${colors.reset} categories (with shortened parent prefixes).${colors.reset}`);
  
  if (repoList.length === 0) {
    console.log(`${colors.fgYellow}No repositories found to sync. Exiting.${colors.reset}`);
    return;
  }

  // Load Token
  let token = process.env.GITHUB_TOKEN;
  if (!token) {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const parts = trimmed.split('=');
          if (parts[0].trim() === 'GITHUB_TOKEN') {
            token = parts.slice(1).join('=').trim();
            // Remove surrounding quotes if they exist
            if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
              token = token.slice(1, -1);
            }
            break;
          }
        }
      }
    }
  }

  if (!token) {
    if (autoSync || autoCheck) {
      console.error(`${colors.fgRed}Error: GitHub PAT not found in GITHUB_TOKEN or token.txt. Cannot run in auto-mode.${colors.reset}`);
      process.exit(1);
    }

    console.log(`\n${colors.fgYellow}GitHub Personal Access Token (PAT) not found in GITHUB_TOKEN environment variable or token.txt.${colors.reset}`);
    console.log(`To create a token, go to: ${colors.underscore}https://github.com/settings/tokens${colors.reset}`);
    console.log(`- For Fine-grained token: Grant "Starring" (write) & "Metadata" (read).`);
    console.log(`- For Classic token: Grant the "repo" or "user" scope (which includes custom lists).\n`);
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    token = await rl.question(`${colors.bright}Please enter your GitHub PAT: ${colors.reset}`);
    token = token.trim();
    rl.close();

    if (!token) {
      console.error(`${colors.fgRed}Error: Token cannot be empty.${colors.reset}`);
      return;
    }
  } else {
    console.log(`${colors.fgGreen}Using token from GITHUB_TOKEN or local file.${colors.reset}`);
  }

  // Fetch existing Lists from GitHub
  console.log(`\nFetching your existing GitHub Star Lists...`);
  let userLists = [];
  try {
    userLists = await fetchUserLists(token);
    console.log(`${colors.fgGreen}Success! Retrieved ${userLists.length} existing lists from your profile.${colors.reset}`);
  } catch (err) {
    console.error(`${colors.fgRed}Failed to fetch user lists: ${err.message}${colors.reset}`);
    console.error(`Please verify that your token is valid and has sufficient permissions.`);
    return;
  }

  // Build current lists membership map: nameWithOwner.toLowerCase() -> Set of List IDs
  const repoToCurrentLists = {};
  for (const list of userLists) {
    const reposInList = list.items?.nodes || [];
    for (const r of reposInList) {
      if (r && r.nameWithOwner) {
        const key = r.nameWithOwner.toLowerCase();
        if (!repoToCurrentLists[key]) {
          repoToCurrentLists[key] = new Set();
        }
        repoToCurrentLists[key].add(list.id);
      }
    }
  }

  // Direct Execution if auto argument is passed
  if (autoSync || autoCheck) {
    await performAction(autoSync, token, categories, userLists, repoList, repoToCategories, repoToCurrentLists);
    return;
  }

  // Interactive Menu Loop
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  while (true) {
    console.log(`\n${colors.bright}Choose an action:${colors.reset}`);
    console.log(` [1] Check status (Show which repos are missing from their target lists)`);
    console.log(` [2] Sync & Categorize (Create lists if needed and assign repos to them)`);
    console.log(` [3] Exit`);
    
    const choice = (await rl.question(`${colors.bright}Enter selection [1-3]: ${colors.reset}`)).trim();

    if (choice === '3') {
      console.log('Goodbye!');
      break;
    }

    if (choice === '1' || choice === '2') {
      const isSyncing = choice === '2';
      await performAction(isSyncing, token, categories, userLists, repoList, repoToCategories, repoToCurrentLists);
      
      // Reload lists in case list creation changed userLists
      if (isSyncing) {
        try {
          userLists = await fetchUserLists(token);
          // Rebuild map
          for (const key of Object.keys(repoToCurrentLists)) {
            repoToCurrentLists[key].clear();
          }
          for (const list of userLists) {
            const reposInList = list.items?.nodes || [];
            for (const r of reposInList) {
              if (r && r.nameWithOwner) {
                const key = r.nameWithOwner.toLowerCase();
                if (!repoToCurrentLists[key]) {
                  repoToCurrentLists[key] = new Set();
                }
                repoToCurrentLists[key].add(list.id);
              }
            }
          }
        } catch (e) {
          // Ignore reload error
        }
      }
    } else {
      console.log(`${colors.fgRed}Invalid selection. Please try again.${colors.reset}`);
    }
  }

  rl.close();
}

main().catch(err => {
  console.error('\nAn unexpected error occurred:', err);
});
