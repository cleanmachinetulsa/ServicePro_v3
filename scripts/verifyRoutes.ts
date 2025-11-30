#!/usr/bin/env npx tsx
/**
 * Route Verification Script
 * 
 * Run before publishing to ensure all pages are properly routed.
 * Usage: npx tsx scripts/verifyRoutes.ts
 * 
 * This script:
 * 1. Scans all page files in client/src/pages/
 * 2. Parses App.tsx to find registered routes and imports
 * 3. Reports orphaned pages (files without routes)
 * 4. Reports potential navigation issues
 */

import fs from 'fs';
import path from 'path';

const PAGES_DIR = path.join(process.cwd(), 'client/src/pages');
const APP_TSX = path.join(process.cwd(), 'client/src/App.tsx');

// Known exceptions - pages that are intentionally not directly routed
const EXCEPTIONS = new Set([
  'not-found.tsx',       // 404 fallback page (special handling)
  'Billing.tsx',         // Intentionally unused duplicate (lowercase billing.tsx is used)
]);

// Template pages that are loaded dynamically via template system
const DYNAMIC_TEMPLATES = new Set([
  'templates/CurrentTemplate.tsx',
  'templates/DynamicSpotlight.tsx', 
  'templates/ExecutiveMinimal.tsx',
  'templates/LuminousConcierge.tsx',
  'templates/NightDriveNeon.tsx',
  'templates/PrestigeGrid.tsx',
  'templates/QuantumConcierge.tsx',
]);

function getAllPageFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (entry.isDirectory()) {
      files.push(...getAllPageFiles(fullPath, baseDir));
    } else if (entry.name.endsWith('.tsx') && !entry.name.startsWith('_')) {
      files.push(relativePath);
    }
  }
  
  return files;
}

function extractImportedPages(content: string): Set<string> {
  const imports = new Set<string>();
  
  // Match various import patterns:
  // import X from "@/pages/Y"
  // import X from "./pages/Y"
  // import X from "../pages/Y"
  // lazy(() => import("@/pages/Y"))
  
  const patterns = [
    /from\s+["']@\/pages\/([^"']+)["']/g,
    /from\s+["']\.\/pages\/([^"']+)["']/g,
    /from\s+["']\.\.\/pages\/([^"']+)["']/g,
    /import\(["']@\/pages\/([^"']+)["']\)/g,
    /import\(["']\.\/pages\/([^"']+)["']\)/g,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let pagePath = match[1];
      // Add .tsx extension if not present
      if (!pagePath.endsWith('.tsx')) {
        pagePath += '.tsx';
      }
      imports.add(pagePath);
    }
  }
  
  return imports;
}

function extractRoutes(content: string): Map<string, string> {
  const routes = new Map<string, string>();
  
  // Match Route components with path props
  // <Route path="/something" component={SomeComponent} />
  // <Route path="/something"><SomeComponent /></Route>
  const routeRegex = /<Route\s+path=["']([^"']+)["'][^>]*(?:component=\{(\w+)\})?/g;
  
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.set(match[1], match[2] || 'inline');
  }
  
  return routes;
}

function normalizeFileName(name: string): string {
  // Convert to lowercase for comparison
  return name.toLowerCase().replace('.tsx', '');
}

function main() {
  console.log('🔍 Route Verification Script\n');
  console.log('='.repeat(60));
  
  // Read App.tsx
  const appContent = fs.readFileSync(APP_TSX, 'utf-8');
  
  // Get all page files
  const pageFiles = getAllPageFiles(PAGES_DIR);
  console.log(`\n📁 Found ${pageFiles.length} page files in client/src/pages/\n`);
  
  // Get imported pages
  const importedPages = extractImportedPages(appContent);
  console.log(`📦 Found ${importedPages.size} page imports in App.tsx\n`);
  
  // Get registered routes
  const routes = extractRoutes(appContent);
  console.log(`🛣️  Found ${routes.size} routes in App.tsx\n`);
  
  // Normalize imports for comparison
  const normalizedImports = new Set<string>();
  for (const imp of importedPages) {
    normalizedImports.add(normalizeFileName(imp));
  }
  
  // Find orphaned pages (files not imported)
  const orphanedPages: string[] = [];
  const templatePages: string[] = [];
  const importedList: string[] = [];
  
  for (const file of pageFiles) {
    const isException = EXCEPTIONS.has(file);
    const isTemplate = DYNAMIC_TEMPLATES.has(file);
    const normalizedFile = normalizeFileName(file);
    const isImported = normalizedImports.has(normalizedFile);
    
    if (isTemplate) {
      templatePages.push(file);
    } else if (isException) {
      // Skip exceptions
    } else if (isImported) {
      importedList.push(file);
    } else {
      orphanedPages.push(file);
    }
  }
  
  // Report results
  let hasIssues = false;
  
  if (orphanedPages.length > 0) {
    hasIssues = true;
    console.log('❌ ORPHANED PAGES (not imported in App.tsx):');
    for (const page of orphanedPages.sort()) {
      console.log(`   - ${page}`);
    }
    console.log('');
  } else {
    console.log('✅ No orphaned pages found!\n');
  }
  
  if (templatePages.length > 0) {
    console.log('📝 TEMPLATE PAGES (dynamically loaded - OK):');
    for (const page of templatePages.sort()) {
      console.log(`   - ${page}`);
    }
    console.log('');
  }
  
  // List registered routes
  console.log('📍 REGISTERED ROUTES:');
  const sortedRoutes = Array.from(routes.keys()).sort();
  for (const route of sortedRoutes) {
    console.log(`   ${route}`);
  }
  console.log('');
  
  // Summary
  console.log('='.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`   Total page files: ${pageFiles.length}`);
  console.log(`   Imported pages: ${importedList.length}`);
  console.log(`   Template pages: ${templatePages.length}`);
  console.log(`   Exceptions: ${EXCEPTIONS.size}`);
  console.log(`   Orphaned pages: ${orphanedPages.length}`);
  console.log(`   Registered routes: ${routes.size}`);
  console.log('');
  
  if (hasIssues) {
    console.log('⚠️  ISSUES FOUND - Review orphaned pages above');
    console.log('   Either add routes for them or add to EXCEPTIONS list');
    process.exit(1);
  } else {
    console.log('✅ All pages are properly routed!');
    process.exit(0);
  }
}

main();
