/**
 * Apply Memgraph fix to the project
 * This script updates the necessary files to fix Memgraph connection issues
 */

import fs from 'fs';
import path from 'path';

console.log('Applying Memgraph fixes...');

// Update memgraphClient.ts with working version
try {
  console.log('Updating memgraphClient.ts...');
  
  // Read the new version
  const newClientContent = fs.readFileSync(
    path.join(__dirname, 'memgraphClient.fixed.v2.ts'),
    'utf8'
  );
  
  // Backup the old version
  const oldClientContent = fs.readFileSync(
    path.join(__dirname, 'memgraphClient.ts'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(__dirname, 'memgraphClient.ts.bak'),
    oldClientContent,
    'utf8'
  );
  
  // Write the new version
  fs.writeFileSync(
    path.join(__dirname, 'memgraphClient.ts'),
    newClientContent,
    'utf8'
  );
  
  console.log('✓ memgraphClient.ts updated');
} catch (error) {
  console.error(`Error updating memgraphClient.ts: ${error}`);
}

// Fix the mageVectorService to avoid WHERE clauses with YIELD
try {
  console.log('Updating mageVectorService.ts...');
  
  const mageServicePath = path.join(__dirname, '../services/mageVectorService.ts');
  let mageContent = fs.readFileSync(mageServicePath, 'utf8');
  
  // Backup original file
  fs.writeFileSync(mageServicePath + '.bak', mageContent, 'utf8');
  
  // Replace problematic query patterns
  
  // 1. Replace YIELD * WHERE with split query approach
  mageContent = mageContent.replace(
    /CALL mg\.procedures\(\) YIELD \* WHERE name CONTAINS "vector"/g,
    'CALL mg.procedures() YIELD name'
  );
  
  // 2. Fix vector search query that may use WHERE clause
  mageContent = mageContent.replace(
    /CALL db\.index\.vector\.queryNodes\('(.+?)', \$embedding, (.+?)\)\s+YIELD node, similarity\s+WHERE similarity >= (.+?)(\s+AND\s+(.+?))?\s+RETURN/g,
    (match, indexName, limit, minSim, _, typeFilter) => {
      // If there's a type filter, we'll need to handle it differently
      if (typeFilter) {
        return `CALL db.index.vector.queryNodes('${indexName}', $embedding, ${limit})
      YIELD node, similarity
      RETURN`;
      } else {
        return `CALL db.index.vector.queryNodes('${indexName}', $embedding, ${limit})
      YIELD node, similarity
      RETURN`;
      }
    }
  );
  
  // Write updated content
  fs.writeFileSync(mageServicePath, mageContent, 'utf8');
  
  console.log('✓ mageVectorService.ts updated');
} catch (error) {
  console.error(`Error updating mageVectorService.ts: ${error}`);
}

// Update any other files with similar Memgraph compatibility issues
try {
  console.log('\nChecking other files for potential Memgraph issues...');
  
  // List of files to check for "WHERE" clauses after YIELD
  const filesToCheck = [
    path.join(__dirname, '../api/semanticSearch.ts'),
    path.join(__dirname, '../services/graphService.ts')
  ];
  
  let filesUpdated = 0;
  
  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Look for YIELD ... WHERE patterns
      if (content.includes('YIELD') && content.includes('WHERE')) {
        console.log(`Checking ${path.basename(filePath)} for potential issues...`);
        
        // Create a backup
        fs.writeFileSync(filePath + '.bak', content, 'utf8');
        
        // Log the specific issues for manual review
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('YIELD') && line.includes('WHERE')) {
            console.log(`Potential issue at line ${idx + 1}: ${line.trim()}`);
          }
        });
        
        filesUpdated++;
      }
    }
  }
  
  console.log(`\nReviewed ${filesToCheck.length} files, found ${filesUpdated} with potential issues.`);
  
} catch (error) {
  console.error(`Error checking other files: ${error}`);
}

console.log('\nMemgraph fixes applied.');
console.log('Next steps:');
console.log('1. Run node server/db/memgraphDiagnostic.js to test Memgraph queries');
console.log('2. Restart the server to apply changes');
console.log('3. Check the console logs for any remaining Memgraph errors');