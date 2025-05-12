import { Client } from "@notionhq/client";

// Initialize Notion client
export const notion = new Client({
    auth: process.env.NOTION_INTEGRATION_SECRET!,
});

// Extract the page ID from the Notion page URL
export function extractPageIdFromUrl(pageUrl: string): string {
    // First try to match UUIDs formatted like 1f174e03-0a8d-808d-b8f8-f53cd5a135eb
    const uuidMatch = pageUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#]|$)/i);
    if (uuidMatch && uuidMatch[1]) {
        return uuidMatch[1];
    }
    
    // Then try the 32-character hex format
    const hexMatch = pageUrl.match(/([a-f0-9]{32})(?:[?#]|$)/i);
    if (hexMatch && hexMatch[1]) {
        return hexMatch[1];
    }

    // Try to extract from Notion's slug format (e.g., mypage-1f174e03xxx)
    const slugMatch = pageUrl.match(/-([a-f0-9]{32})(?:[?#]|$)/i);
    if (slugMatch && slugMatch[1]) {
        return slugMatch[1];
    }

    // Handle Notion's shorter format, typically seen in the browser
    const shortMatch = pageUrl.match(/notion\.so\/([^/]+)\/([a-z0-9]+)(?:[?#]|$)/i);
    if (shortMatch && shortMatch[2]) {
        return shortMatch[2];
    }

    // Handle simple workspace/page-id format
    const simpleMatch = pageUrl.match(/notion\.so\/[^/]*([a-z0-9]+)(?:[?#]|$)/i);
    if (simpleMatch && simpleMatch[1]) {
        return simpleMatch[1];
    }

    console.log("Could not extract page ID from URL:", pageUrl);
    // Fallback to using the URL as is if it looks like it might be a valid ID
    if (pageUrl && (pageUrl.length === 32 || pageUrl.length === 36)) {
        console.log("Using URL directly as page ID");
        return pageUrl;
    }

    throw Error("Failed to extract page ID from URL: " + pageUrl);
}

export const NOTION_PAGE_ID = extractPageIdFromUrl(process.env.NOTION_PAGE_URL!);

/**
 * Lists all child databases contained within NOTION_PAGE_ID
 * @returns {Promise<Array<{id: string, title: string}>>} - Array of database objects with id and title
 */
export async function getNotionDatabases() {
    // Array to store the child databases
    const childDatabases = [];

    try {
        // Query all child blocks in the specified page
        let hasMore = true;
        let startCursor: string | undefined = undefined;

        while (hasMore) {
            const response = await notion.blocks.children.list({
                block_id: NOTION_PAGE_ID,
                start_cursor: startCursor,
            });

            // Process the results
            for (const block of response.results) {
                // Check if the block is a child database
                if (block.type === "child_database") {
                    const databaseId = block.id;

                    // Retrieve the database title
                    try {
                        const databaseInfo = await notion.databases.retrieve({
                            database_id: databaseId,
                        });

                        // Add the database to our list
                        childDatabases.push(databaseInfo);
                    } catch (error) {
                        console.error(`Error retrieving database ${databaseId}:`, error);
                    }
                }
            }

            // Check if there are more results to fetch
            hasMore = response.has_more;
            startCursor = response.next_cursor || undefined;
        }

        return childDatabases;
    } catch (error) {
        console.error("Error listing child databases:", error);
        throw error;
    }
}

// Find and get a Notion database with the matching title
export async function findDatabaseByTitle(title: string) {
    const databases = await getNotionDatabases();

    for (const db of databases) {
        if (db.title && Array.isArray(db.title) && db.title.length > 0) {
            const dbTitle = db.title[0]?.plain_text?.toLowerCase() || "";
            if (dbTitle === title.toLowerCase()) {
                return db;
            }
        }
    }

    return null;
}

// Create a new database if one with a matching title does not exist
export async function createDatabaseIfNotExists(title: string, properties: any) {
    const existingDb = await findDatabaseByTitle(title);
    if (existingDb) {
        return existingDb;
    }
    return await notion.databases.create({
        parent: {
            type: "page_id",
            page_id: NOTION_PAGE_ID
        },
        title: [
            {
                type: "text",
                text: {
                    content: title
                }
            }
        ],
        properties
    });
}

// Example function to Get all nodes from the Notion database
export async function getNodesFromNotion(nodesDatabaseId: string) {
    try {
        const response = await notion.databases.query({
            database_id: nodesDatabaseId,
        });

        return response.results.map((page: any) => {
            const properties = page.properties;

            return {
                notionId: page.id,
                id: properties.Id?.rich_text?.[0]?.plain_text,
                content: properties.Content?.rich_text?.[0]?.plain_text || "",
                type: properties.Type?.select?.name || "topic",
                importance: properties.Importance?.number || 0.5,
                keywords: properties.Keywords?.multi_select?.map((k: any) => k.name) || [],
                position: {
                    x: properties.PositionX?.number || 0,
                    y: properties.PositionY?.number || 0,
                    z: properties.PositionZ?.number || 0
                }
            };
        });
    } catch (error) {
        console.error("Error fetching nodes from Notion:", error);
        throw new Error("Failed to fetch nodes from Notion");
    }
}

// Example function to Get all edges from the Notion database
export async function getEdgesFromNotion(edgesDatabaseId: string) {
    try {
        const response = await notion.databases.query({
            database_id: edgesDatabaseId,
        });

        return response.results.map((page: any) => {
            const properties = page.properties;

            return {
                notionId: page.id,
                id: properties.Id?.rich_text?.[0]?.plain_text,
                source: properties.Source?.rich_text?.[0]?.plain_text || "",
                target: properties.Target?.rich_text?.[0]?.plain_text || "",
                relationship: properties.Relationship?.select?.name || "related_to",
                strength: properties.Strength?.number || 0.5
            };
        });
    } catch (error) {
        console.error("Error fetching edges from Notion:", error);
        throw new Error("Failed to fetch edges from Notion");
    }
}