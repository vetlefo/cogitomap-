// OpenAI API models
export const AI_MODELS = {
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo'
};

// Visualization constants
export const VISUALIZATION = {
  // Node sizing
  MIN_NODE_SIZE: 0.5,
  MAX_NODE_SIZE: 2.0,
  
  // Camera settings
  CAMERA_DEFAULT_POSITION: [0, 0, 15],
  CAMERA_FOV: 60,
  
  // Bubble colors
  USER_BUBBLE_COLOR: 0x0066ff, // Blue
  AI_BUBBLE_COLOR: 0x00ff99,   // Green
  HOVER_COLOR_MULTIPLIER: 1.4,
  
  // Edge settings
  EDGE_COLOR: 0x00ffff, // Cyan
  EDGE_OPACITY: 0.5,
  
  // Grid settings
  GRID_SIZE: 40,
  GRID_DIVISIONS: 40,
  GRID_COLOR_MAIN: 0x00ffff, // Cyan
  GRID_COLOR_SECONDARY: 0x004040, // Dark cyan
  
  // Drone settings
  DRONE_COUNT: 3,
  DRONE_SPEED_MIN: 0.02,
  DRONE_SPEED_MAX: 0.04,
  
  // Animation
  ANIMATION_SPEED: 0.05
};

// UI constants
export const UI = {
  CHAT_INTERFACE_WIDTH: 350,
  CHAT_MAX_HEIGHT_PERCENTAGE: 60,
  MODEL_SELECTOR_WIDTH: 200
};

// Message constants
export const MESSAGES = {
  WELCOME: 'Welcome! I\'ll help you visualize our conversation as a 3D knowledge graph.',
  API_KEY_REQUIRED: 'Please enter your OpenAI API key to begin.',
  ERROR: 'Sorry, there was an error processing your request. Please check your API key and try again.'
};
