// Simple test script to verify Memgraph connectivity
import neo4j from 'neo4j-driver';

// Import environment variables
const MEMGRAPH_URI = process.env.MEMGRAPH_URI;
const MEMGRAPH_USERNAME = process.env.MEMGRAPH_USERNAME;
const MEMGRAPH_PASSWORD = process.env.MEMGRAPH_PASSWORD;

console.log(`Attempting to connect to Memgraph at ${MEMGRAPH_URI}`);
console.log(`Using username: ${MEMGRAPH_USERNAME ? "provided" : "not provided"}`);
console.log(`Password length: ${MEMGRAPH_PASSWORD ? MEMGRAPH_PASSWORD.length : 0}`);

const testMemgraphConnection = async (uri, username, password) => {
    console.log("Creating driver...");
    const driver = neo4j.driver(uri, neo4j.auth.basic(username, password), {
        connectionTimeout: 10000, // 10 seconds timeout
    });

    console.log("Opening session...");
    const session = driver.session();
    const testMessage = 'Test connection from CogitoMap';

    try {
        console.log("Testing connectivity...");
        await driver.verifyConnectivity();
        console.log("Connection verified successfully!");

        console.log("Running test query...");
        const result = await session.run(
            `CREATE (n:TestNode {message: $message, timestamp: timestamp()}) RETURN n`,
            { message: testMessage },
        );

        const singleRecord = result.records[0];
        const node = singleRecord.get(0);

        console.log('Created test node:', node.properties.message, 'at', node.properties.timestamp);
        console.log('Connection test successful!');
    } catch (error) {
        console.error("Connection test failed:", error);
    } finally {
        console.log("Closing session...");
        await session.close();
    }

    console.log("Closing driver...");
    await driver.close();
    console.log("Test complete");
};

// Execute the test
testMemgraphConnection(MEMGRAPH_URI, MEMGRAPH_USERNAME, MEMGRAPH_PASSWORD)
    .catch((error) => console.error("Unhandled error:", error))
    .finally(() => console.log("Test script execution completed"));