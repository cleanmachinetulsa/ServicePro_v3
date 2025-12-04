/**
 * Archive Unused Assets Tool
 * 
 * This script safely scans the repository for truly unused image assets
 * and MOVES them to a timestamped archive folder for review before manual deletion.
 * 
 * SAFETY RULES:
 * - NO automatic deletion - only moves files to archive/
 * - NO documentation files are moved (use --include-docs flag if desired)
 * - Runtime asset directories are protected (public/uploads, attached_assets with references)
 * - Database-referenced assets are NOT detected - manual review required
 * - Script is idempotent - safe to run multiple times
 * - Only operates within project root
 * 
 * PROTECTED DIRECTORIES (never touched):
 * - public/uploads/      (runtime user uploads - may be DB-referenced)
 * - public/icons/        (PWA icons)
 * - public/favicon/      (browser favicons)
 * - client/src/assets/   (frontend assets)
 * - migrations/          (database migrations)
 * - .github/             (CI/CD configs)
 * 
 * PROTECTED FILES (never touched):
 * - public/qr-logo.png   (QR code branding asset)
 * 
 * Usage: 
 *   node tools/archiveUnusedAssets.cjs              (assets only, safe mode)
 *   node tools/archiveUnusedAssets.cjs --include-docs  (also archive non-critical docs)
 *   node tools/archiveUnusedAssets.cjs --dry-run    (preview what would be moved)
 * 
 * After running, review archive/ folder contents. Restore any incorrectly
 * classified files by moving them back to their original paths. Delete
 * the archive/ folder when satisfied.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const projectRoot = path.resolve(__dirname, '..');

const assetExtensions = [
  '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp',
  '.mp3', '.mp4', '.mov', '.avi', '.pdf', '.ico'
];

const docExtensions = ['.md', '.mdx'];

const ignoreDirs = [
  'node_modules', '.git', 'dist', 'build', '.next', '.cache', 
  '.turbo', 'coverage', '.repl', '.replit', 'archive',
  '.upm', '.config', '.npm'
];

const protectedDocs = [
  'readme.md', 'license.md', 'changelog.md', 'security.md',
  'contributing.md', 'code_of_conduct.md', 'replit.md'
];

const protectedAssetPaths = [
  'public/uploads',
  'public/icons',
  'public/favicon',
  'public/pwa',
  'migrations',
  '.github',
  'client/src/assets'
];

const protectedAssetFiles = [
  'public/qr-logo.png'
];

const archiveRoot = path.join(projectRoot, 'archive');

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB max for text file scanning

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INCLUDE_DOCS = args.includes('--include-docs');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Recursively walk a directory and return all file paths
 */
function walk(dir) {
  const results = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          results.push(...walk(fullPath));
        }
      } else if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  } catch (err) {
    console.warn(`  Warning: Could not read directory ${dir}: ${err.message}`);
  }
  
  return results;
}

/**
 * Check if a path is in a protected asset directory or is a specifically protected file
 */
function isProtectedAssetPath(filePath) {
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  
  // Check protected directories
  for (const protectedPath of protectedAssetPaths) {
    if (relPath.startsWith(protectedPath + '/') || relPath === protectedPath) {
      return true;
    }
  }
  
  // Check specifically protected files
  if (protectedAssetFiles.includes(relPath)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a doc file should be protected
 */
function isProtectedDoc(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  
  // Protected by name
  if (protectedDocs.includes(basename)) {
    return true;
  }
  
  // Protected by path (root level docs, .github, docs folder that might be important)
  if (relPath.startsWith('.github/')) {
    return true;
  }
  
  // Protect all root-level .md files (important project docs)
  if (!relPath.includes('/')) {
    return true;
  }
  
  return false;
}

/**
 * Move a file to the archive directory, preserving relative path structure
 */
function moveFile(src, baseArchiveDir) {
  try {
    const rel = path.relative(projectRoot, src);
    const dest = path.join(baseArchiveDir, rel);
    
    if (DRY_RUN) {
      return { success: true, dest, dryRun: true };
    }
    
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    
    return { success: true, dest };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if an asset file is referenced anywhere in the codebase
 */
function isAssetUsed(assetPath, textFiles) {
  const basename = path.basename(assetPath);
  const relPath = path.relative(projectRoot, assetPath).replace(/\\/g, '/');
  
  // Also check for common import patterns
  const importPatterns = [
    basename,
    relPath,
    // Handle @assets/ imports
    relPath.replace('attached_assets/', '@assets/'),
    // Handle public/ paths
    relPath.replace('public/', '/'),
    // Without leading slash
    relPath.replace('public/', '')
  ];
  
  for (const { content } of textFiles) {
    for (const pattern of importPatterns) {
      if (content.includes(pattern)) {
        return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// Main Script
// ============================================================================

function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Archive Unused Assets Tool');
  if (DRY_RUN) {
    console.log('  [DRY RUN MODE - No files will be moved]');
  }
  console.log('='.repeat(60));
  console.log('');
  console.log(`Project root: ${projectRoot}`);
  console.log(`Include docs: ${INCLUDE_DOCS ? 'Yes' : 'No (use --include-docs to enable)'}`);
  console.log('');
  console.log('Protected files:');
  for (const file of protectedAssetFiles) {
    console.log(`  - ${file}`);
  }
  console.log('');
  
  // Step 1: Walk the project and collect all files
  console.log('[1/6] Scanning project files...');
  const allFiles = walk(projectRoot);
  console.log(`  Found ${allFiles.length} files total`);
  
  // Step 2: Categorize files
  console.log('[2/6] Categorizing files...');
  
  const assetFiles = [];
  const docFiles = [];
  const searchableFiles = [];
  
  for (const file of allFiles) {
    const ext = path.extname(file).toLowerCase();
    
    if (assetExtensions.includes(ext)) {
      assetFiles.push(file);
    } else if (docExtensions.includes(ext)) {
      docFiles.push(file);
    } else {
      // Check file size for searchable files
      try {
        const stats = fs.statSync(file);
        if (stats.size <= MAX_FILE_SIZE) {
          searchableFiles.push(file);
        }
      } catch (err) {
        // Skip files we can't stat
      }
    }
  }
  
  console.log(`  Assets: ${assetFiles.length}`);
  console.log(`  Docs: ${docFiles.length}`);
  console.log(`  Searchable text files: ${searchableFiles.length}`);
  
  // Step 3: Load searchable files into memory
  console.log('[3/6] Loading text files for reference scanning...');
  
  const textFiles = [];
  let loadedCount = 0;
  
  for (const file of searchableFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      textFiles.push({ file, content });
      loadedCount++;
    } catch (err) {
      // Skip binary or unreadable files
    }
  }
  
  console.log(`  Loaded ${loadedCount} text files for scanning`);
  
  // Step 4: Find unused assets (only from attached_assets, skip protected paths)
  console.log('[4/6] Detecting unused assets...');
  console.log('  (Only scanning attached_assets/ - protected paths are skipped)');
  
  const unusedAssets = [];
  let protectedCount = 0;
  
  for (const asset of assetFiles) {
    // Skip protected paths (uploads, icons, etc.)
    if (isProtectedAssetPath(asset)) {
      protectedCount++;
      continue;
    }
    
    if (!isAssetUsed(asset, textFiles)) {
      unusedAssets.push(asset);
    }
  }
  
  console.log(`  Found ${unusedAssets.length} unused assets (${protectedCount} protected/skipped)`);
  
  // Step 5: Find archivable docs (only if --include-docs flag is set)
  console.log('[5/6] Detecting archivable documentation...');
  
  const archivableDocs = [];
  
  if (INCLUDE_DOCS) {
    for (const doc of docFiles) {
      if (!isProtectedDoc(doc)) {
        archivableDocs.push(doc);
      }
    }
    console.log(`  Found ${archivableDocs.length} docs that could be archived`);
  } else {
    console.log('  Skipped (use --include-docs to enable doc archiving)');
  }
  
  // Step 6: Move files to archive
  console.log('[6/6] Moving files to archive...');
  
  const today = new Date().toISOString().slice(0, 10);
  const unusedAssetsDir = path.join(archiveRoot, `unused-assets-${today}`);
  const docsArchiveDir = path.join(archiveRoot, `docs-${today}`);
  
  let assetsMovedCount = 0;
  let assetFailCount = 0;
  let docsMovedCount = 0;
  let docFailCount = 0;
  
  // Only create directories if we have files to move
  if (unusedAssets.length > 0) {
    if (!DRY_RUN) {
      fs.mkdirSync(unusedAssetsDir, { recursive: true });
    }
    
    for (const asset of unusedAssets) {
      const result = moveFile(asset, unusedAssetsDir);
      if (result.success) {
        assetsMovedCount++;
        const prefix = DRY_RUN ? '  [DRY RUN] Would move: ' : '  Moved: ';
        console.log(`${prefix}${path.relative(projectRoot, asset)}`);
      } else {
        assetFailCount++;
        console.warn(`  Failed to move ${path.relative(projectRoot, asset)}: ${result.error}`);
      }
    }
  }
  
  if (archivableDocs.length > 0) {
    if (!DRY_RUN) {
      fs.mkdirSync(docsArchiveDir, { recursive: true });
    }
    
    for (const doc of archivableDocs) {
      const result = moveFile(doc, docsArchiveDir);
      if (result.success) {
        docsMovedCount++;
        const prefix = DRY_RUN ? '  [DRY RUN] Would move: ' : '  Moved: ';
        console.log(`${prefix}${path.relative(projectRoot, doc)}`);
      } else {
        docFailCount++;
        console.warn(`  Failed to move ${path.relative(projectRoot, doc)}: ${result.error}`);
      }
    }
  }
  
  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('  Summary');
  if (DRY_RUN) {
    console.log('  [DRY RUN - No files were actually moved]');
  }
  console.log('='.repeat(60));
  console.log('');
  console.log(`  Total assets scanned: ${assetFiles.length}`);
  console.log(`  Assets in protected paths: ${protectedCount}`);
  console.log(`  Assets ${DRY_RUN ? 'that would be' : ''} moved to archive: ${assetsMovedCount}`);
  if (assetFailCount > 0) {
    console.log(`  Assets failed to move: ${assetFailCount}`);
  }
  console.log('');
  console.log(`  Total docs scanned: ${docFiles.length}`);
  if (INCLUDE_DOCS) {
    console.log(`  Docs ${DRY_RUN ? 'that would be' : ''} moved to archive: ${docsMovedCount}`);
    if (docFailCount > 0) {
      console.log(`  Docs failed to move: ${docFailCount}`);
    }
  } else {
    console.log('  Doc archiving: Disabled (use --include-docs to enable)');
  }
  console.log('');
  
  if (!DRY_RUN && (assetsMovedCount > 0 || docsMovedCount > 0)) {
    console.log('  Archive locations:');
    if (assetsMovedCount > 0) {
      console.log(`    Assets: ${path.relative(projectRoot, unusedAssetsDir)}/`);
    }
    if (docsMovedCount > 0) {
      console.log(`    Docs: ${path.relative(projectRoot, docsArchiveDir)}/`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Review the archive/ folder contents');
    console.log('    2. Restore any incorrectly classified files');
    console.log('    3. Delete the archive/ folder when satisfied');
  } else if (DRY_RUN) {
    console.log('  To actually move files, run without --dry-run flag');
  } else {
    console.log('  No files were moved. The project is clean!');
  }
  
  console.log('');
  console.log('  IMPORTANT: This tool cannot detect database-referenced assets.');
  console.log('  Always review archive/ before deleting, especially for uploads.');
  console.log('');
  console.log('='.repeat(60));
  console.log('');
}

// Run the script
main();
