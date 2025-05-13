import { z } from 'zod';

/**
 * Schema for entity type definitions
 * 
 * This defines structural metadata for nodes in the knowledge graph, 
 * similar to AirWeave's EntityDefinition.
 */
export const EntityDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1), // Corresponds to BubbleNode.type
  description: z.string().optional(),
  // Basic schema for custom properties this entity type can have
  propertySchema: z.record(z.any()).optional(),
  icon: z.string().optional(), // For UI representation
  color: z.string().optional(), // Default color for this type
});

export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;

/**
 * Schema for relationship type definitions
 * 
 * This defines structural metadata for edges in the knowledge graph,
 * similar to AirWeave's EntityRelation.
 */
export const RelationshipDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1), // Corresponds to Edge.relationship
  description: z.string().optional(),
  allowedSourceTypes: z.array(z.string()).optional(), // References EntityDefinition.name
  allowedTargetTypes: z.array(z.string()).optional(), // References EntityDefinition.name
  directed: z.boolean().default(true),
  strength: z.number().min(0).max(1).default(0.5),
  color: z.string().optional(), // For visual representation
  propertySchema: z.record(z.any()).optional(), // Schema for additional edge properties
  bidirectionalLabel: z.string().optional(), // Label when displayed bidirectionally
  sourceToTargetLabel: z.string().optional(), // Label from source to target
  targetToSourceLabel: z.string().optional(), // Label from target to source
});

export type RelationshipDefinition = z.infer<typeof RelationshipDefinitionSchema>;

/**
 * Default relationship definitions for core system types
 */
export const defaultRelationshipDefinitions: RelationshipDefinition[] = [
  {
    id: "1287e5c4-6284-4153-a462-a2f864fc7e25",
    name: "response_to",
    description: "Indicates that one message is a response to another",
    allowedSourceTypes: ["ai_message"],
    allowedTargetTypes: ["user_message"],
    directed: true,
    strength: 1.0,
    sourceToTargetLabel: "responds to",
    targetToSourceLabel: "answered by",
  },
  {
    id: "a78d6a2e-55e5-4723-9e07-8249aa5c601b",
    name: "mentions",
    description: "Indicates that a message mentions a topic or entity",
    allowedSourceTypes: ["user_message", "ai_message"],
    allowedTargetTypes: ["topic", "entity"],
    directed: true,
    strength: 0.7,
    sourceToTargetLabel: "mentions",
    targetToSourceLabel: "mentioned in",
  },
  {
    id: "3b6f2d3a-7d84-4e5b-9b4c-25f9c2e8dfa1",
    name: "elaborates",
    description: "Indicates that one node provides more detail about another",
    allowedSourceTypes: ["ai_message", "topic", "entity", "summary"],
    allowedTargetTypes: ["topic", "entity", "summary"],
    directed: true,
    strength: 0.8,
    sourceToTargetLabel: "elaborates on",
    targetToSourceLabel: "elaborated by",
  },
  {
    id: "d5e7f8b2-9c1a-4d3b-8e5f-7a6b5c4d3e2f",
    name: "supports",
    description: "Indicates that one node provides evidence or support for another",
    allowedSourceTypes: ["ai_message", "topic", "entity"],
    allowedTargetTypes: ["topic", "entity"],
    directed: true,
    strength: 0.9,
    sourceToTargetLabel: "supports",
    targetToSourceLabel: "supported by",
  },
  {
    id: "e1d2c3b4-a5b6-7c8d-9e0f-1a2b3c4d5e6f",
    name: "contradicts",
    description: "Indicates that one node contradicts or opposes another",
    allowedSourceTypes: ["ai_message", "topic", "entity"],
    allowedTargetTypes: ["topic", "entity"],
    directed: true,
    strength: 0.9,
    sourceToTargetLabel: "contradicts",
    targetToSourceLabel: "contradicted by",
  },
  {
    id: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    name: "summarizes",
    description: "Indicates that one node summarizes content from another",
    allowedSourceTypes: ["summary"],
    allowedTargetTypes: ["user_message", "ai_message", "topic", "entity"],
    directed: true,
    strength: 0.7,
    sourceToTargetLabel: "summarizes",
    targetToSourceLabel: "summarized by",
  },
  {
    id: "f1e2d3c4-b5a6-7d8c-9e0f-1b2a3c4d5e6",
    name: "raises_question",
    description: "Indicates that one node raises a question about another",
    allowedSourceTypes: ["ai_message", "topic", "entity", "question"],
    allowedTargetTypes: ["topic", "entity"],
    directed: true,
    strength: 0.6,
    sourceToTargetLabel: "raises question about",
    targetToSourceLabel: "questioned by",
  },
];