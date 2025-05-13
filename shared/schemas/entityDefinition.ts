import { z } from 'zod';

/**
 * Schema for entity type definitions
 * 
 * This defines the structure and validation rules for different types of entities
 * in the knowledge graph. Inspired by AirWeave's entity definition approach.
 */

/**
 * Schema for property definitions within an entity type
 */
export const PropertyDefinitionSchema = z.object({
  name: z.string().min(1).describe('Property name'),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object', 'date']).describe('Data type of the property'),
  description: z.string().optional().describe('Description of what this property represents'),
  required: z.boolean().default(false).describe('Whether this property is required'),
  defaultValue: z.any().optional().describe('Default value if none is provided'),
  options: z.array(z.string()).optional().describe('For enum-like string properties, the list of valid values'),
  isSystemManaged: z.boolean().default(false).describe('Whether this property is managed by the system and not user-editable'),
});

/**
 * Schema for entity definition
 */
export const EntityDefinitionSchema = z.object({
  id: z.string().describe('Unique identifier for this entity definition'),
  name: z.string().min(1).describe('Display name of the entity type'),
  description: z.string().optional().describe('Description of this entity type'),
  nodeType: z.string().describe('Corresponds to the NodeType in the visualization system'),
  properties: z.record(PropertyDefinitionSchema).describe('Map of property names to their definitions'),
  isAbstract: z.boolean().default(false).describe('Whether this is an abstract type that cannot be directly instantiated'),
  parentTypeId: z.string().optional().describe('For inheritance, the ID of the parent type'),
  defaultImportance: z.number().min(0).max(1).default(0.5).describe('Default importance value for entities of this type'),
  defaultColor: z.string().optional().describe('Default color for visualization'),
  defaultIcon: z.string().optional().describe('Default icon for UI representation'),
  allowedRelationships: z.array(z.string()).optional().describe('Types of relationships this entity can participate in'),
  systemType: z.boolean().default(false).describe('Whether this is a built-in system type'),
  version: z.number().default(1).describe('Schema version for handling migrations'),
  createdAt: z.string().optional().describe('When this definition was created'),
  updatedAt: z.string().optional().describe('When this definition was last updated'),
});

// Type derived from the Zod schema
export type EntityDefinition = z.infer<typeof EntityDefinitionSchema>;
export type PropertyDefinition = z.infer<typeof PropertyDefinitionSchema>;

/**
 * Default entity definitions for core system types
 */
export const defaultEntityDefinitions: EntityDefinition[] = [
  {
    id: 'message',
    name: 'Message',
    description: 'A message in a conversation',
    nodeType: 'user_message',
    properties: {
      content: {
        name: 'Content',
        type: 'string',
        description: 'The message text',
        required: true,
      },
      role: {
        name: 'Role',
        type: 'string',
        description: 'Who sent the message (user or assistant)',
        required: true,
        options: ['user', 'assistant', 'system'],
      },
      timestamp: {
        name: 'Timestamp',
        type: 'date',
        description: 'When the message was sent',
        isSystemManaged: true,
      },
    },
    defaultImportance: 0.6,
    version: 1,
  },
  {
    id: 'topic',
    name: 'Topic',
    description: 'A topic or concept discussed in the conversation',
    nodeType: 'topic',
    properties: {
      name: {
        name: 'Name',
        type: 'string',
        description: 'The name of the topic',
        required: true,
      },
      description: {
        name: 'Description',
        type: 'string',
        description: 'A brief description of the topic',
      },
    },
    defaultImportance: 0.7,
    version: 1,
  },
  {
    id: 'entity',
    name: 'Entity',
    description: 'A named entity mentioned in the conversation',
    nodeType: 'entity',
    properties: {
      name: {
        name: 'Name',
        type: 'string',
        description: 'The name of the entity',
        required: true,
      },
      type: {
        name: 'Entity Type',
        type: 'string',
        description: 'The type of entity (PERSON, ORG, etc.)',
        required: true,
      },
      description: {
        name: 'Description',
        type: 'string',
        description: 'A brief description of the entity',
      },
    },
    defaultImportance: 0.65,
    version: 1,
  },
  {
    id: 'summary',
    name: 'Summary',
    description: 'A summary of multiple nodes or conversations',
    nodeType: 'summary',
    properties: {
      title: {
        name: 'Title',
        type: 'string',
        description: 'The title of the summary',
        required: true,
      },
      content: {
        name: 'Content',
        type: 'string',
        description: 'The summary text',
        required: true,
      },
      nodeIds: {
        name: 'Node IDs',
        type: 'array',
        description: 'IDs of nodes that are summarized',
      },
    },
    defaultImportance: 0.8,
    version: 1,
  },
];