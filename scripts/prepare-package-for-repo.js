#!/usr/bin/env node
/**
 * Prepares an overlay package for use as a standalone git repository.
 * Usage: node scripts/prepare-package-for-repo.js <package-name>
 * Example: node scripts/prepare-package-for-repo.js overlay-view-wheel
 *
 * Copies the package to ../<package-name>/ (sibling of this repo), inits git,
 * and writes REPO-README.md with steps to add remote and push.
 * Run from the Overlay repo root.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const packagesDir = path.join(repoRoot, 'packages');

const packageName = process.argv[2];
if (!packageName) {
  console.error('Usage: node scripts/prepare-package-for-repo.js <package-name>');
  console.error('Example: node scripts/prepare-package-for-repo.js overlay-view-wheel');
  process.exit(1);
}

const srcDir = path.join(packagesDir, packageName);
const destDir = path.join(repoRoot, '..', packageName);

if (!fs.existsSync(srcDir)) {
  console.error('Package not found:', srcDir);
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === 'node_modules') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('Copying', packageName, 'to', destDir);
if (fs.existsSync(destDir)) {
  console.error('Destination already exists:', destDir);
  console.error('Remove it first or choose another location.');
  process.exit(1);
}
copyRecursive(srcDir, destDir);

console.log('Initializing git in', destDir);
execSync('git init', { cwd: destDir, stdio: 'inherit' });

const readmePath = path.join(destDir, 'REPO-README.md');
const pkgJsonPath = path.join(destDir, 'package.json');
const hasOverlayCore = fs.existsSync(pkgJsonPath) && require(pkgJsonPath).dependencies?.['overlay-core'];

const readme = `# ${packageName} (standalone repo)

This package was extracted from the Overlay monorepo. Use it in the integration app by installing from this repo or from npm after publishing.

## Next steps

1. **Fix \`overlay-core\` dependency** (if this package depends on it):
   In \`package.json\`, replace \`"overlay-core": "file:../overlay-core"\` with either:
   - \`"overlay-core": "git+https://github.com/YOUR_ORG/overlay-core.git"\`
   - or \`"overlay-core": "^1.0.0"\` after publishing overlay-core to npm.

2. **Add remote and push**:
   \`\`\`bash
   git remote add origin https://github.com/YOUR_ORG/${packageName}.git
   git add -A && git commit -m "Initial extract from Overlay monorepo"
   git branch -M main && git push -u origin main
   \`\`\`

3. **Use from integration app**: In the Overlay repo \`package.json\`, replace
   \`"${packageName}": "file:packages/${packageName}"\` with
   \`"${packageName}": "git+https://github.com/YOUR_ORG/${packageName}.git"\`
   (or an npm package name after publishing), then run \`npm install\`.
`;

fs.writeFileSync(readmePath, readme, 'utf8');
console.log('Wrote', readmePath);
console.log('Done. Go to', destDir, 'and follow REPO-README.md to add remote and push.');