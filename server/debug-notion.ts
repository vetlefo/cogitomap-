/**
 * Debug utility for Notion integration
 */

import { Client } from "@notionhq/client";
import { extractPageIdFromUrl } from "./notion";

// Get environment variables
const NOTION_INTEGRATION_SECRET = process.env.NOTION_INTEGRATION_SECRET;
const NOTION_PAGE_URL = process.env.NOTION_PAGE_URL;

async function debugNotion() {
  console.log("=== Notion Debug Information ===");
  
  // Check for environment variables
  console.log("\nEnvironment Variables:");
  console.log(`NOTION_INTEGRATION_SECRET: ${NOTION_INTEGRATION_SECRET ? '✓ Set' : '✗ Not set'}`);
  console.log(`NOTION_PAGE_URL: ${NOTION_PAGE_URL ? '✓ Set' : '✗ Not set'}`);
  
  if (!NOTION_INTEGRATION_SECRET) {
    console.log("\n❌ NOTION_INTEGRATION_SECRET is missing. Please set this environment variable.");
    return;
  }
  
  if (!NOTION_PAGE_URL) {
    console.log("\n❌ NOTION_PAGE_URL is missing. Please set this environment variable.");
    return;
  }
  
  // Extract page ID
  try {
    const pageId = extractPageIdFromUrl(NOTION_PAGE_URL);
    console.log(`\nExtracted Page ID: ${pageId}`);
    
    // Initialize Notion client
    const notion = new Client({
      auth: NOTION_INTEGRATION_SECRET
    });
    
    // Test connection by getting user list
    try {
      console.log("\nTesting connection to Notion API...");
      const users = await notion.users.list({});
      console.log(`✓ Successfully connected to Notion API. Found ${users.results.length} users.`);
      
      // List bot user
      const botUser = users.results.find(user => user.type === 'bot');
      if (botUser) {
        console.log(`Bot user: ${botUser.name} (${botUser.id})`);
      }
      
      // Try to access the page
      try {
        console.log(`\nTrying to access page with ID: ${pageId}`);
        const page = await notion.pages.retrieve({ page_id: pageId });
        console.log("✓ Successfully accessed the page!");
        console.log("Page info:", JSON.stringify(page, null, 2).substring(0, 500) + "...");
        
        // Try to list children
        try {
          console.log(`\nListing child blocks of the page...`);
          const children = await notion.blocks.children.list({ block_id: pageId });
          console.log(`✓ Successfully listed ${children.results.length} child blocks.`);
          
          if (children.results.length > 0) {
            console.log("First few child blocks:", 
              children.results.slice(0, 3).map(block => {
                const type = (block as any).type;
                return `${block.id} (${type || 'unknown type'})`;
              })
            );
          }
        } catch (error: any) {
          console.log(`❌ Failed to list child blocks: ${error.message}`);
          console.log("Error details:", error);
        }
        
      } catch (error: any) {
        console.log(`❌ Failed to access the page: ${error.message}`);
        console.log("Error details:", error);
        
        if (error.code === 'object_not_found') {
          console.log("\nPossible causes:");
          console.log("1. The page ID is incorrect");
          console.log("2. The integration doesn't have access to the page");
          console.log("\nSolutions:");
          console.log("1. Check the NOTION_PAGE_URL for correctness");
          console.log("2. Share the page with your integration (click 'Share' > select your integration)");
        }
      }
      
    } catch (error: any) {
      console.log(`❌ Failed to connect to Notion API: ${error.message}`);
      console.log("Error details:", error);
      
      if (error.code === 'unauthorized') {
        console.log("\nPossible cause: The integration token is invalid or expired");
        console.log("Solution: Generate a new integration token at https://www.notion.so/my-integrations");
      }
    }
    
  } catch (error: any) {
    console.log(`\n❌ Failed to extract page ID: ${error.message}`);
  }
}

debugNotion().catch(console.error);