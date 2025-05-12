# Notion Integration Setup Guide

This guide will help you properly set up the connection between CogitoMap and Notion.

## Step 1: Create a Notion Integration

1. Visit [Notion Integrations Page](https://www.notion.so/my-integrations)
2. Click "Create new integration"
3. Name it "CogitoMap" (or any name you prefer)
4. Set the appropriate capabilities:
   - Read content
   - Update content 
   - Insert content
5. Click "Submit" to create the integration
6. Copy the "Internal Integration Secret" (it looks like `secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

## Step 2: Set the Environment Variables

Add these to your environment variables:

```
NOTION_INTEGRATION_SECRET=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PAGE_URL=https://www.notion.so/Your-Page-Name-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Step 3: Share Your Notion Page with the Integration

This is the most critical step! The integration can't access your Notion pages until you explicitly share them.

1. Open your Notion page in a browser
2. Click the "Share" button in the top right corner
3. In the "Add people, groups, or integrations" search box, type the name of your integration (e.g., "CogitoMap")
4. Select your integration from the dropdown
5. Click "Invite"

![Notion Share Dialog](https://notionfiles.s3.amazonaws.com/share-integration.png)

## Step 4: Test the Connection

Run our debug utility to verify the connection:

```
cd server && tsx debug-notion.ts
```

You should see:
```
✓ Successfully connected to Notion API
✓ Successfully accessed the page
✓ Successfully retrieved X blocks from the page
```

## Troubleshooting

### If you see: "Could not find page with ID..."

This means the integration doesn't have permission to access your page. Make sure:

1. You've shared the exact page from the NOTION_PAGE_URL with your integration
2. The page ID in the URL matches the one you're trying to access
3. The integration has the necessary capabilities (Read content at minimum)

### If you see: "Failed to connect to Notion API"

This means your integration token is invalid. Check:

1. The NOTION_INTEGRATION_SECRET environment variable is set correctly
2. The token hasn't expired or been revoked
3. You're not using a public integration token in a private integration, or vice versa

## Database Creation

Once connected, our application will automatically create the necessary databases in your Notion page:

1. **Nodes Database** - Stores all knowledge graph nodes 
2. **Edges Database** - Stores relationships between nodes

These will appear as linked databases on your Notion page.