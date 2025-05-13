/**
 * Test script to debug fallbackStorage
 */
import { fallbackStorage } from '../../server/db/fallbackStorage';

// Create test node
const testNode = {
  id: 'test-debug-node',
  content: 'This is a test node for debugging',
  type: 'topic',
  position: { x: 0, y: 0, z: 0 },
  importance: 0.5,
  keywords: ['test', 'debug']
};

// Create nodes and test retrieval
fallbackStorage.createNode(testNode);

// Check storage size
console.log('Internal nodes map size:', fallbackStorage.debug_getNodesSize());

// Get all nodes
const allNodes = fallbackStorage.getAllNodes();
console.log('getAllNodes result:', JSON.stringify(allNodes, null, 2));

// Get node by ID
const retrievedNode = fallbackStorage.getNode('test-debug-node');
console.log('Retrieved node by ID:', retrievedNode ? 'Found' : 'Not found');