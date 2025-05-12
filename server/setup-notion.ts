import { notion, NOTION_PAGE_ID, createDatabaseIfNotExists, findDatabaseByTitle } from "./notion";

// Environment variables validation
if (!process.env.NOTION_INTEGRATION_SECRET) {
    throw new Error("NOTION_INTEGRATION_SECRET is not defined. Please add it to your environment variables.");
}

// Setup databases for the knowledge graph
async function setupNotionDatabases() {
    // Nodes database - for storing all graph nodes
    await createDatabaseIfNotExists("Knowledge Graph Nodes", {
        // Node ID
        Id: {
            rich_text: {}
        },
        // Node content/title
        Content: {
            rich_text: {}
        },
        // Node type
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
        // Node importance
        Importance: {
            number: {}
        },
        // Node keywords
        Keywords: {
            multi_select: {
                options: []
            }
        },
        // Node position coordinates
        PositionX: {
            number: {}
        },
        PositionY: {
            number: {}
        },
        PositionZ: {
            number: {}
        },
        // Vector embedding (as text for storage)
        Embedding: {
            rich_text: {}
        }
    });

    // Edges database - for storing all graph relationships
    await createDatabaseIfNotExists("Knowledge Graph Edges", {
        // Edge ID
        Id: {
            rich_text: {}
        },
        // Source node ID
        Source: {
            rich_text: {}
        },
        // Target node ID
        Target: {
            rich_text: {}
        },
        // Relationship type
        Relationship: {
            select: {
                options: [
                    { name: "response_to", color: "blue" },
                    { name: "mentions", color: "green" },
                    { name: "elaborates", color: "orange" },
                    { name: "supports", color: "purple" },
                    { name: "contradicts", color: "red" },
                    { name: "summarizes", color: "yellow" },
                    { name: "raises_question", color: "gray" },
                    { name: "related_to", color: "default" }
                ]
            }
        },
        // Connection strength
        Strength: {
            number: {}
        }
    });
}

async function createSampleData() {
    try {
        console.log("Adding sample data...");

        // Find the databases
        const nodesDb = await findDatabaseByTitle("Knowledge Graph Nodes");
        const edgesDb = await findDatabaseByTitle("Knowledge Graph Edges");

        if (!nodesDb || !edgesDb) {
            throw new Error("Could not find the required databases.");
        }

        // Create sample nodes
        const nodes = [
            {
                id: "topic-knowledge-graph",
                content: "A knowledge graph is a network of entities, their semantic types, properties, and relationships.",
                type: "topic",
                importance: 0.8,
                keywords: ["knowledge graph", "semantic", "network", "entities", "relationships"],
                x: 5,
                y: 2,
                z: -5
            },
            {
                id: "entity-graph-visualization",
                content: "Graph visualization techniques help users understand complex relationships and network structures through interactive displays.",
                type: "entity",
                importance: 0.75,
                keywords: ["visualization", "graph", "network", "interactive", "display"],
                x: -5,
                y: 3,
                z: -8
            },
            {
                id: "ai_message-welcome",
                content: "Welcome! I'll help you visualize our conversation as a 3D knowledge graph.",
                type: "ai_message",
                importance: 0.7,
                keywords: ["welcome", "visualization", "conversation", "knowledge graph"],
                x: 0,
                y: 0,
                z: 0
            }
        ];

        // Create each node in Notion
        for (const node of nodes) {
            await notion.pages.create({
                parent: {
                    database_id: nodesDb.id
                },
                properties: {
                    Id: {
                        rich_text: [
                            {
                                text: {
                                    content: node.id
                                }
                            }
                        ]
                    },
                    Content: {
                        rich_text: [
                            {
                                text: {
                                    content: node.content
                                }
                            }
                        ]
                    },
                    Type: {
                        select: {
                            name: node.type
                        }
                    },
                    Importance: {
                        number: node.importance
                    },
                    Keywords: {
                        multi_select: node.keywords.map(keyword => ({
                            name: keyword
                        }))
                    },
                    PositionX: {
                        number: node.x
                    },
                    PositionY: {
                        number: node.y
                    },
                    PositionZ: {
                        number: node.z
                    }
                }
            });

            console.log(`Created node: ${node.id}`);
        }

        // Create a sample edge
        const edge = {
            id: "topic-knowledge-graph-related_to-entity-graph-visualization",
            source: "topic-knowledge-graph",
            target: "entity-graph-visualization",
            relationship: "related_to",
            strength: 0.85
        };

        await notion.pages.create({
            parent: {
                database_id: edgesDb.id
            },
            properties: {
                Id: {
                    rich_text: [
                        {
                            text: {
                                content: edge.id
                            }
                        }
                    ]
                },
                Source: {
                    rich_text: [
                        {
                            text: {
                                content: edge.source
                            }
                        }
                    ]
                },
                Target: {
                    rich_text: [
                        {
                            text: {
                                content: edge.target
                            }
                        }
                    ]
                },
                Relationship: {
                    select: {
                        name: edge.relationship
                    }
                },
                Strength: {
                    number: edge.strength
                }
            }
        });

        console.log(`Created edge: ${edge.id}`);
        console.log("Sample data creation complete.");
    } catch (error) {
        console.error("Error creating sample data:", error);
    }
}

// Run the setup
setupNotionDatabases().then(() => {
    return createSampleData();
}).then(() => {
    console.log("Setup complete!");
    process.exit(0);
}).catch(error => {
    console.error("Setup failed:", error);
    process.exit(1);
});