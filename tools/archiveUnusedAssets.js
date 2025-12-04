/**
 * Archive Unused Assets & Documentation Tool
 * 
 * This script safely scans the repository for unused assets (images, media) and
 * non-essential markdown documentation, then MOVES them to timestamped archive
 * folders for review before manual deletion.
 * 
 * SAFETY RULES:
 * - NO automatic deletion - only moves files to archive/
 * - Protected files are never moved (README.md, LICENSE.md, etc.)
 * - Database, config, env, and build files are never touched
 * - Script is idempotent - safe to run multiple times
 * - Only operates within project root
 * 
 * Usage: npm run archive:unused
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
  'contributing.md', 'code_of_conduct.md'
];

const protectedPaths = [
  '.github',
  'migrations',
  'public/favicon',
  'public/icons'
];

const archiveRoot = path.join(projectRoot, 'archive');

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB max for text file scanning

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
 * Check if a path should be protected from archiving
 */
function isProtectedPath(filePath) {
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  
  for (const protectedPath of protectedPaths) {
    if (relPath.startsWith(protectedPath + '/') || relPath === protectedPath) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a doc file should be protected
 */
function isProtectedDoc(filePath) {
  const basename = path.basename(filePath).toLowerCase();
  
  if (protectedDocs.includes(basename)) {
    return true;
  }
  
  if (isProtectedPath(filePath)) {
    return true;
  }
  
  // Also protect replit.md specifically
  if (basename === 'replit.md') {
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
  console.log('  Archive Unused Assets & Documentation Tool');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Project root: ${projectRoot}`);
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
  
  // Step 4: Find unused assets
  console.log('[4/6] Detecting unused assets...');
  
  const unusedAssets = [];
  
  for (const asset of assetFiles) {
    // Skip protected paths
    if (isProtectedPath(asset)) {
      continue;
    }
    
    if (!isAssetUsed(asset, textFiles)) {
      unusedAssets.push(asset);
    }
  }
  
  console.log(`  Found ${unusedAssets.length} unused assets`);
  
  // Step 5: Find archivable docs
  console.log('[5/6] Detecting archivable documentation...');
  
  const archivableDocs = [];
  
  for (const doc of docFiles) {
    if (!isProtectedDoc(doc)) {
      archivableDocs.push(doc);
    }
  }
  
  console.log(`  Found ${archivableDocs.length} docs to archive`);
  
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
    fs.mkdirSync(unusedAssetsDir, { recursive: true });
    
    for (const asset of unusedAssets) {
      const result = moveFile(asset, unusedAssetsDir);
      if (result.success) {
        assetsMovedCount++;
        console.log(`  Moved: ${path.relative(projectRoot, asset)}`);
      } else {
        assetFailCount++;
        console.warn(`  Failed to move ${path.relative(projectRoot, asset)}: ${result.error}`);
      }
    }
  }
  
  if (archivableDocs.length > 0) {
    fs.mkdirSync(docsArchiveDir, { recursive: true });
    
    for (const doc of archivableDocs) {
      const result = moveFile(doc, docsArchiveDir);
      if (result.success) {
        docsMovedCount++;
        console.log(`  Moved: ${path.relative(projectRoot, doc)}`);
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
  console.log('='.repeat(60));
  console.log('');
  console.log(`  Total assets scanned: ${assetFiles.length}`);
  console.log(`  Assets moved to archive: ${assetsMovedCount}`);
  if (assetFailCount > 0) {
    console.log(`  Assets failed to move: ${assetFailCount}`);
  }
  console.log('');
  console.log(`  Total docs scanned: ${docFiles.length}`);
  console.log(`  Docs moved to archive: ${docsMovedCount}`);
  if (docFailCount > 0) {
    console.log(`  Docs failed to move: ${docFailCount}`);
  }
  console.log('');
  
  if (assetsMovedCount > 0 || docsMovedCount > 0) {
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
  } else {
    console.log('  No files were moved. The project is clean!');
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('');
}

// Run the script
main();
