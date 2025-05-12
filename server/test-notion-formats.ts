/**
 * Test script for trying different Notion page ID formats
 */

import { Client } from "@notionhq/client";

// Get environment variables
const NOTION_INTEGRATION_SECRET = process.env.NOTION_INTEGRATION_SECRET;
const NOTION_PAGE_URL = process.env.NOTION_PAGE_URL;

// Initialize Notion client
const notion = new Client({
  auth: NOTION_INTEGRATION_SECRET!
});

/**
 * Extract and try different formats of page IDs
 */
async function testNotionIdFormats() {
  console.log("=== Testing Different Notion Page ID Formats ===\n");
  
  // Check for environment variables
  if (!NOTION_INTEGRATION_SECRET || !NOTION_PAGE_URL) {
    console.log("❌ Missing environment variables. Set NOTION_INTEGRATION_SECRET and NOTION_PAGE_URL.");
    return;
  }
  
  console.log(`Raw URL: ${NOTION_PAGE_URL}`);
  
  // Try to extract the ID in various formats
  const formats: { name: string; id: string }[] = [];
  
  // Try to extract UUID in standard format (with dashes)
  const uuidMatch = NOTION_PAGE_URL.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#]|$)/i);
  if (uuidMatch && uuidMatch[1]) {
    formats.push({ name: "UUID format", id: uuidMatch[1] });
  }
  
  // Try 32-character hex without dashes
  const hexMatch = NOTION_PAGE_URL.match(/([a-f0-9]{32})(?:[?#]|$)/i);
  if (hexMatch && hexMatch[1]) {
    const hex = hexMatch[1];
    formats.push({ name: "Raw hex", id: hex });
    
    // Also format with dashes
    const formatted = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    formats.push({ name: "Hex with dashes", id: formatted });
  }
  
  // Try different variations of the URL-based ID
  if (NOTION_PAGE_URL.includes("notion.so")) {
    // Try the last part of the URL after the last slash
    const parts = NOTION_PAGE_URL.split("/");
    const lastPart = parts[parts.length - 1].split("?")[0];
    if (lastPart && lastPart.length > 8) {
      formats.push({ name: "Last URL segment", id: lastPart });
    }
    
    // Try extracting from title-id format
    const titleIdMatch = NOTION_PAGE_URL.match(/([^/]+-[a-f0-9]{32})(?:[?#]|$)/i);
    if (titleIdMatch && titleIdMatch[1]) {
      formats.push({ name: "Title-ID format", id: titleIdMatch[1] });
      
      // Extract just the ID part
      const idPart = titleIdMatch[1].split("-").pop();
      if (idPart && idPart.length === 32) {
        formats.push({ name: "ID from Title-ID", id: idPart });
      }
    }
  }
  
  // Add one more format - try with hyphens removed
  const existingWithDashes = formats.find(f => f.id.includes("-"));
  if (existingWithDashes) {
    formats.push({
      name: "Dashes removed",
      id: existingWithDashes.id.replace(/-/g, "")
    });
  }
  
  console.log(`\nFound ${formats.length} possible ID formats to try:\n`);
  
  // Test each format
  for (const format of formats) {
    console.log(`\n--- Testing: ${format.name} ---`);
    console.log(`ID: ${format.id}`);
    
    try {
      const page = await notion.pages.retrieve({ page_id: format.id });
      console.log(`✅ SUCCESS! This format works: ${format.name}`);
      console.log(`Page ID: ${page.id}`);
      break; // Stop after first success
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
  
  console.log("\n=== Testing Complete ===");
}

// Run the test
testNotionIdFormats().catch(console.error);