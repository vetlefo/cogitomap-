const fs = require('fs');

// Create a JSON message with main_response
const jsonMessage = {
  main_response: "Here are ten interconnected topics that form an intriguing web of relationships: Climate Change, Renewable Energy, Technological Innovation, Urbanization, Global Health, Economic Development, Artificial Intelligence, Cybersecurity, Education, and Social Media.",
  identified_topics: ["Climate Change", "Renewable Energy", "Technological Innovation"],
  summary: "Various contemporary topics interconnect through cause-effect relationships and technological impacts.",
  sentiment: "neutral",
  entity_categories: [
    {
      category_name: "Environmental Topics",
      description: "Topics related to environmental challenges and solutions",
      importance: 9,
      entities: [
        {
          entity: "Climate Change",
          type: "CONCEPT",
          importance: 10,
          description: "Long-term shifts in temperatures and weather patterns."
        },
        {
          entity: "Renewable Energy",
          type: "CONCEPT",
          importance: 9,
          description: "Energy collected from renewable resources."
        }
      ]
    }
  ]
}

// Write to file
fs.writeFileSync('sample_message.json', JSON.stringify(jsonMessage, null, 2));

// Test the API with this message
const testCommand = `curl -X POST http://localhost:5000/api/chat/pipeline \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "What are 10 different topics that are connected in an interesting way?"},
      {"role": "assistant", "content": ${JSON.stringify(JSON.stringify(jsonMessage))}}
    ],
    "userId": "test-user"
  }' > json_test_result.json && cat json_test_result.json | grep main_response`;

// Execute the command
require('child_process').execSync(testCommand, {stdio: 'inherit'});