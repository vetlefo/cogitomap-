# CogitoMap: 3D Interactive Knowledge Graph Visualization

CogitoMap is a cutting-edge 3D interactive visualization platform that transforms AI conversations into immersive, navigable knowledge graphs. The application uses a distinctive cyberpunk design language to represent conversation nodes as interactive bubbles and visualize the connections between different pieces of information.


## Key Features

### Core Visualization
- **3D Knowledge Graph**: Visualize conversations as interconnected 3D nodes in a responsive environment
- **Interactive Bubbles**: Each concept or message appears as a 3D bubble with color-coding based on type
- **Dynamic Connections**: Relationship strength between nodes shown through distinctive line styles
- **Cyberpunk Aesthetic**: Neon-colored elements with a modern, high-tech look and feel

### AI Integration
- **Multi-Provider Support**: Works with OpenAI, Anthropic, and Google Gemini
- **Secure API Handling**: Environment-based API key management
- **Context Mapping**: Automatically builds a knowledge graph from conversations
- **Sentiment Analysis**: Color-coding based on detected sentiment

### Advanced Features
- **Agent Drones**: AI agents navigate between conversation nodes with visual effects
- **Parallel Conversations**: Create separate conversation windows for exploring different paths
- **Node Selection**: Select multiple nodes to explore relationships
- **Second Opinions**: Compare different model perspectives on the same topics
- **Bidirectional Selection**: Click messages to select related nodes or nodes to highlight messages
- **Node Validation**: Approve or reject second opinions with visual confirmation

### Navigation & Interface
- **Full 3D Controls**: Pan, zoom, and rotate the graph for better visualization
- **Selection Panel**: Manage selected nodes with a dedicated interface
- **Expandable Chat**: Toggle between visualization and conversation views

## Using CogitoMap

### Starting a Conversation
1. Enter your initial message in the chat input at the bottom
2. The system will process your message and create the first node(s)
3. Continue the conversation to expand the knowledge graph

### Navigating the Visualization
- **Pan**: Click and drag to move around the space
- **Rotate**: Right-click and drag to rotate the view
- **Zoom**: Use the scroll wheel to zoom in and out
- **Click Nodes**: Select a node to focus on it
- **Shift+Click**: Select multiple nodes for comparison

### Node Types and Colors
- **User Messages**: Blue spheres
- **AI Messages**: Green spheres
- **Topics**: Purple icosahedrons
- **Entities**: Orange cubes
- **Summaries**: Yellow dodecahedrons
- **Questions**: Red octahedrons

### Multi-select and Second Opinions
1. Hold Shift while clicking nodes to select multiple items
2. Use the node panel to request a second opinion
3. A new conversation window will open focusing on the selected concepts
4. Second opinion nodes appear with distinctive colors
5. Use the validation UI to accept or reject insights from second opinions

### Keyboard Shortcuts
- **Shift + Click**: Multi-select nodes
- **Esc**: Clear all selections
- **Space**: Toggle between chat and visualization focus

## Technical Architecture

### Frontend
- React with TypeScript
- Three.js with React Three Fiber for 3D rendering
- Zustand for state management
- Tailwind CSS for styling

### Backend
- Express.js server
- API routing for multiple LLM providers
- PostgreSQL database support
- Authentication system

### Key Components
- **ContextVisualizer**: Main 3D visualization component
- **ContextBubble**: Individual node representation
- **ChatInterface**: Conversation UI
- **ParallelWindowsManager**: Handles multiple conversation windows
- **AgentDrone**: Animated AI agents navigating the graph
- **SelectedNodesPanel**: Interface for managing multi-selected nodes

## Future Development

- **Voice Integration**: Speech-to-text and text-to-speech for conversational interaction
- **Collaboration**: Multi-user support for team exploration of concepts
- **Advanced Filters**: Filter visualization by type, sentiment, or relevance
- **Export Options**: Save knowledge graphs for sharing or embedding
- **Custom Themes**: Selectable visualization styles beyond the default cyberpunk look
- **Performance Optimization**: Further improvements for larger knowledge graphs

## Getting Started for Developers

```bash
# Clone the repository
git clone <repository-url>

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Environment Variables

```
# Required for API connections
OPENAI_API_KEY=your_openai_key_here

# Optional for additional providers
ANTHROPIC_API_KEY=your_anthropic_key_here
GOOGLE_API_KEY=your_google_key_here
```

## Feedback and Contributions

We welcome your feedback and contributions to CogitoMap! Feel free to open issues or submit pull requests on our repository.