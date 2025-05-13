/**
 * Master script to apply all Memgraph fixes
 * This script combines all the fixes from our diagnostic and updates the main codebase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('==== APPLYING MEMGRAPH 3.0 COMPATIBILITY FIXES ====');

// Get directory name equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Files that need to be updated
const filesToUpdate = [
  {
    source: path.join(__dirname, 'memgraphClient.updated.ts'),
    target: path.join(__dirname, 'memgraphClient.ts'),
    backup: path.join(__dirname, 'memgraphClient.bak.ts')
  }
];

// Process each file
for (const file of filesToUpdate) {
  try {
    console.log(`Processing ${path.basename(file.target)}...`);
    
    // Check if source file exists
    if (!fs.existsSync(file.source)) {
      console.error(`Source file ${file.source} does not exist, skipping`);
      continue;
    }
    
    // Create backup if target exists
    if (fs.existsSync(file.target)) {
      console.log(`Creating backup of ${path.basename(file.target)} at ${path.basename(file.backup)}`);
      fs.copyFileSync(file.target, file.backup);
    }
    
    // Copy the updated file to the target
    console.log(`Copying ${path.basename(file.source)} to ${path.basename(file.target)}`);
    fs.copyFileSync(file.source, file.target);
    
    console.log(`✓ Updated ${path.basename(file.target)}`);
  } catch (error) {
    console.error(`Error updating ${file.target}: ${error}`);
  }
}

// Fix LSP error in the updated file
try {
  console.log('\nFixing type issues in memgraphClient.ts...');
  
  const memgraphClientPath = path.join(__dirname, 'memgraphClient.ts');
  let content = fs.readFileSync(memgraphClientPath, 'utf8');
  
  // Update import line to fix neo4j namespace error
  content = content.replace(
    "import neo4j from 'neo4j-driver';",
    "import * as neo4j from 'neo4j-driver';"
  );
  
  // Fix record.toObject() type issue
  content = content.replace(
    "    return result.records.map(record => {",
    "    return result.records.map((record: any) => {"
  );
  
  // Write the updated content
  fs.writeFileSync(memgraphClientPath, content, 'utf8');
  console.log('✓ Fixed type issues in memgraphClient.ts');
} catch (error) {
  console.error(`Error fixing type issues: ${error}`);
}

// Update db.index.vector procedure calls in other files
try {
  console.log('\nUpdating vector search queries in other files...');
  
  const filesToScan = [
    path.join(__dirname, '../services/graphService.ts'),
    path.join(__dirname, '../services/transformers/keywordExtractionTransformer.ts')
  ];
  
  let filesUpdated = 0;
  
  for (const filePath of filesToScan) {
    if (fs.existsSync(filePath)) {
      console.log(`Checking ${path.basename(filePath)}...`);
      
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;
      
      // Replace vector_idx_all queries
      if (content.includes('db.index.vector.queryNodes')) {
        content = content.replace(
          /CALL\s+db\.index\.vector\.queryNodes\s*\(\s*['"](.+?)['"]\s*,\s*(.+?)\s*,\s*(\d+)(?:\s*,\s*([\d\.]+))?\s*\)\s+YIELD\s+node\s*,\s*similarity\s+WHERE\s+similarity\s*>=\s*([\d\.]+)/gi,
          "CALL vector_search.search('$1', $3, $2) YIELD node, similarity WITH node, similarity WHERE similarity >= $5"
        );
      }
      
      // Replace YIELD ... WHERE patterns
      content = content.replace(
        /(\s+YIELD\s+(?:[\w\s,]+)\s+)WHERE(\s+)/gi,
        "$1WITH $2"
      );
      
      // Update only if changes were made
      if (content !== originalContent) {
        // Create backup
        fs.writeFileSync(`${filePath}.bak`, originalContent, 'utf8');
        
        // Write updated content
        fs.writeFileSync(filePath, content, 'utf8');
        
        console.log(`✓ Updated ${path.basename(filePath)}`);
        filesUpdated++;
      } else {
        console.log(`No changes needed in ${path.basename(filePath)}`);
      }
    } else {
      console.log(`File ${filePath} not found, skipping`);
    }
  }
  
  console.log(`\nUpdated ${filesUpdated} additional files with vector search fixes`);
} catch (error) {
  console.error(`Error updating vector search queries: ${error}`);
}

console.log('\n==== MEMGRAPH 3.0 COMPATIBILITY FIXES COMPLETE ====');
console.log('Next steps:');
console.log('1. Restart the server to apply all changes');
console.log('2. Check logs for any remaining Memgraph errors');
console.log('3. Verify that vector search is working correctly');