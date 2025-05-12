/**
 * Create a new Notion page to use with the integration
 */

import { Client } from "@notionhq/client";

// Get environment variables
const NOTION_INTEGRATION_SECRET = process.env.NOTION_INTEGRATION_SECRET;

// Initialize Notion client
const notion = new Client({
  auth: NOTION_INTEGRATION_SECRET!
});

async function createPage() {
  console.log("=== Creating a new Notion page for CogitoMap ===\n");
  
  // Check for environment variable
  if (!NOTION_INTEGRATION_SECRET) {
    console.log("❌ NOTION_INTEGRATION_SECRET is missing. Please set this environment variable.");
    return;
  }
  
  try {
    // List all workspaces this integration has access to
    console.log("Fetching workspaces...");
    const response = await notion.search({
      filter: {
        value: "workspace",
        property: "object"
      }
    });
    
    if (response.results.length === 0) {
      console.log("❌ No workspaces found. Make sure your integration has access to at least one workspace.");
      console.log("Tip: Share an existing page with your integration first to grant workspace access.");
      return;
    }
    
    console.log(`Found ${response.results.length} workspace(s).`);
    
    // Create a new page
    console.log("\nCreating new page...");
    const newPage = await notion.pages.create({
      parent: {
        type: "workspace",
        workspace: true
      },
      properties: {
        title: [
          {
            text: {
              content: "CogitoMap Knowledge Graph"
            }
          }
        ]
      },
      children: [
        {
          object: "block",
          type: "heading_1",
          heading_1: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "CogitoMap Knowledge Graph"
                }
              }
            ]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content: "This page was automatically created by CogitoMap. It will be used to store your knowledge graph data from conversations."
                }
              }
            ]
          }
        },
        {
          object: "block",
          type: "callout",
          callout: {
            rich_text: [
              {
                type: "text", 
                text: {
                  content: "Two databases will be created below: Nodes and Edges."
                }
              }
            ],
            icon: {
              emoji: "📌"
            },
            color: "blue_background"
          }
        }
      ]
    });
    
    console.log(`✅ New page created!`);
    console.log(`Page ID: ${newPage.id}`);
    
    // Construct the URL to the new page
    const pageUrl = `https://notion.so/${newPage.id.replace(/-/g, "")}`;
    
    console.log(`\nPage URL: ${pageUrl}`);
    console.log("\nPlease update your NOTION_PAGE_URL environment variable with this URL.");
    console.log("Then run 'tsx server/setup-notion-databases.ts' to create the necessary databases.");
    
  } catch (error: any) {
    console.error("❌ Error creating Notion page:", error.message);
    console.error("Details:", error);
    
    if (error.code === 'unauthorized') {
      console.log("\nPossible cause: The integration token is invalid or doesn't have workspace access.");
      console.log("Solution: Share an existing page with your integration first to grant workspace access.");
    }
  }
}

// Run the script
createPage().catch(console.error);