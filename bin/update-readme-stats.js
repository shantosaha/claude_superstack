const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

// Helper to count files and lines recursively
function getCodeMetrics(dir, extFilter, excludeDirs = ['.git', 'node_modules', '.vault', '.graphify']) {
  let fileCount = 0;
  let lineCount = 0;

  function traverse(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!excludeDirs.includes(file)) {
          traverse(fullPath);
        }
      } else {
        const ext = path.extname(file);
        if (extFilter.includes(ext) || extFilter.includes(file)) {
          fileCount++;
          const content = fs.readFileSync(fullPath, 'utf8');
          lineCount += content.split('\n').length;
        }
      }
    }
  }

  traverse(dir);
  return { fileCount, lineCount };
}

// 1. Get Version from bin/superstack
let version = '1.0.0';
const superstackCliPath = path.join(repoRoot, 'bin', 'superstack');
if (fs.existsSync(superstackCliPath)) {
  const cliContent = fs.readFileSync(superstackCliPath, 'utf8');
  const match = cliContent.match(/VERSION="([^"]+)"/);
  if (match) {
    version = match[1];
  }
}

// 2. Compute Metrics
const scriptMetrics = getCodeMetrics(repoRoot, ['.sh', '.ps1', 'superstack']);
const docMetrics = getCodeMetrics(path.join(repoRoot, 'documents'), ['.md', '.html', '.pdf']);
const totalFilesMetrics = getCodeMetrics(repoRoot, ['.sh', '.ps1', '.json', '.md', '.html', 'superstack']);

// 3. Format Stats Table
const lastUpdated = new Date().toISOString().split('T')[0];

const statsContent = `
| Metric | Value | Description |
|---|---|---|
| **SuperStack Version** | \`v${version}\` | Current release version |
| **Integrated Frameworks** | \`10\` | Unified Claude Code extensions |
| **Automation Scripts** | \`${scriptMetrics.fileCount} files\` (${scriptMetrics.lineCount} lines) | Core installation & orchestration |
| **Documentation Assets** | \`${docMetrics.fileCount} guides\` | Deep-dives, manuals, and schemas |
| **Last Auto-Updated** | \`${lastUpdated}\` | Triggered by latest repository push |
`;

// 4. Update README.md
const readmePath = path.join(repoRoot, 'README.md');
if (fs.existsSync(readmePath)) {
  let readmeContent = fs.readFileSync(readmePath, 'utf8');
  const startTag = '<!-- STATS_START -->';
  const endTag = '<!-- STATS_END -->';

  const startIndex = readmeContent.indexOf(startTag);
  const endIndex = readmeContent.indexOf(endTag);

  if (startIndex !== -1 && endIndex !== -1) {
    const before = readmeContent.substring(0, startIndex + startTag.length);
    const after = readmeContent.substring(endIndex);
    const updatedContent = before + '\n' + statsContent.trim() + '\n' + after;

    fs.writeFileSync(readmePath, updatedContent, 'utf8');
    console.log('Successfully updated README.md stats!');
  } else {
    console.error('Placeholder tags not found in README.md!');
  }
} else {
  console.error('README.md not found!');
}
