/**
 * Setup script for Notion databases
 * 
 * This script creates the necessary databases in Notion for storing knowledge graph data:
 * 1. Nodes Database - For storing all graph nodes (topics, entities, messages, etc.)
 * 2. Edges Database - For storing relationships between nodes
 */

import { Client } from "@notionhq/client";
import { NodeType, RelationshipType } from "../client/src/types";
import { notion, NOTION_PAGE_ID, createDatabaseIfNotExists } from "./notion";

async function setupDatabases() {
  console.log("=== Setting up Notion Databases ===\n");
  
  try {
    console.log(`Using Notion page ID: ${NOTION_PAGE_ID}`);
    
    // Create Nodes database
    console.log("\nCreating Nodes database...");
    const nodesDatabase = await createDatabaseIfNotExists("Knowledge Graph Nodes", {
      // Every database needs a Name/Title property
      Title: {
        title: {}
      },
      Content: {
        rich_text: {}
      },
      Type: {
        select: {
          options: [
            { name: "user_message", color: "blue" },
            { name: "ai_message", color: "green" },
            { name: "topic", color: "orange" },
            { name: "entity", color: "purple" },
            { name: "summary", color: "yellow" },
            { name: "question", color: "red" }
          ]
        }
      },
      Importance: {
        number: {
          format: "number_with_commas"
        }
      },
      Keywords: {
        multi_select: {
          options: []
        }
      },
      Sentiment: {
        select: {
          options: [
            { name: "positive", color: "green" },
            { name: "negative", color: "red" },
            { name: "neutral", color: "gray" }
          ]
        }
      },
      Embedding: {
        rich_text: {}
      },
      ExternalId: {
        rich_text: {}
      },
      CreatedAt: {
        date: {}
      }
    });
    
    console.log(`✅ Nodes database created: ${nodesDatabase.id}`);
    
    // Create Edges database
    console.log("\nCreating Edges database...");
    const edgesDatabase = await createDatabaseIfNotExists("Knowledge Graph Edges", {
      // Every database needs a Name/Title property
      Title: {
        title: {}
      },
      SourceNode: {
        relation: {
          database_id: nodesDatabase.id,
          single_property: {}
        }
      },
      TargetNode: {
        relation: {
          database_id: nodesDatabase.id,
          single_property: {}
        }
      },
      Relationship: {
        select: {
          options: [
            { name: "response_to", color: "blue" },
            { name: "mentions", color: "green" },
            { name: "elaborates", color: "orange" },
            { name: "supports", color: "purple" },
            { name: "contradicts", color: "red" },
            { name: "summarizes", color: "yellow" },
            { name: "raises_question", color: "pink" }
          ]
        }
      },
      Strength: {
        number: {
          format: "number_with_commas"
        }
      },
      ExternalId: {
        rich_text: {}
      }
    });
    
    console.log(`✅ Edges database created: ${edgesDatabase.id}`);
    
    console.log("\n✅ All databases created successfully!");
    console.log("\nYou can now use the Notion integration in CogitoMap.");
    
  } catch (error: any) {
    console.error("\n❌ Error setting up Notion databases:", error.message);
    console.error("Details:", error);
    
    if (error.code === 'object_not_found') {
      console.log("\nThe most common issue is that your page is not shared with the integration.");
      console.log("Please follow these steps to fix:");
      console.log("1. Go to your Notion page: " + process.env.NOTION_PAGE_URL);
      console.log("2. Click 'Share' in the top right corner");
      console.log("3. In the search box, type your integration name (e.g., 'CogitoMap')");
      console.log("4. Select your integration and click 'Invite'");
      console.log("5. Run this script again");
    }
  }
}

// Run the setup
setupDatabases().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});