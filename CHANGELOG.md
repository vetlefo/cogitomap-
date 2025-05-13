# Changelog

All notable changes to CogitoMap will be documented in this file.

## [Unreleased] - 2025-05-13

### Added
- Multi-selection feature with shift+click to select multiple nodes
- Selected nodes panel for better navigation of complex knowledge graphs
- "Second Opinion" feature allows comparing perspectives from different models
- Parallel conversation windows for exploring multiple conversation threads
- Persistent node panel toggle button for improved accessibility
- Enhanced particle effects for more immersive visual experience

### Changed
- Significantly improved node spacing throughout the visualization
  - Expanded base radius for all node types
  - Added randomized positioning variance to prevent clustering
  - Implemented semi-random offsets based on content to naturally separate nodes
- Enhanced visual appearance of nodes
  - Increased size and detail of node geometries for better visibility
  - Optimized materials with improved emissive properties
  - Made node types more visually distinct with clearer geometry differences
- Expanded camera and controls settings
  - Increased camera distance for better overview (15 to 50 units)
  - Extended orbit controls range (now 10-150 units)
  - Removed fog for maximum visibility
- Increased grid size to accommodate wider visualization (60 to 150 units)

### Fixed
- Critical 3D rendering issues with position validation in SceneManager and ContextVisualizer
- Edge creation API validation errors by ensuring correct parameter passing
- Multiple instances of incorrect edge creation handling in ChatInterface
- Improved error handling for undefined or null node positions
- Reduced overwhelming cloud/glow effects for better clarity
- Fixed parameter formatting in createEdge function calls to ensure proper type safety
- Added proper error handling with nested try/catch blocks in semantic analysis service
- Implemented LLMResponse type definition to handle different API response formats
- Enhanced JSON parsing with multiple fallback mechanisms for reliable content extraction
- Added proper type annotations to improve TypeScript compatibility across semantic services

### Technical Improvements
- Enhanced position validation to gracefully handle undefined/null values
- Fixed incorrect parameter handling in edge creation APIs (string IDs vs objects)
- Improved Graph DB synchronization with API endpoints
- Added cleanup callbacks to prevent memory leaks in component unmounts
- Implemented deterministic pseudo-random variations for consistent node placement

## Planned Future Improvements
- Implement semantic embedding-based node positioning
- Further optimize "Second Opinion" feature visually
- Complete API key handling improvements for better security
- Performance optimizations for larger knowledge graphs
- Enhanced bidirectional selection between chat and visualization
- Standardize and enhance core data models to support more structured definitions
- Expand BubbleNode interface with fields for better data provenance
- Add support for entity relationships with improved type definitions
- Improve data versioning and tracking with additional metadata fields