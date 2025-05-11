import { z } from 'zod';

/**
 * Schema for entity objects within the structured output
 */
export const EntitySchema = z.object({
  entity: z.string().min(1).describe('The name of the entity'),
  type: z.string().min(1).describe('The type of entity (e.g., PERSON, ORG, LOC, etc.)'),
  description: z.string().max(100).optional().describe('Brief description of the entity'),
  importance: z.number().min(1).max(10).optional().describe('Importance score from 1-10')
});

/**
 * Schema for category objects to group similar entities
 */
export const CategorySchema = z.object({
  category_name: z.string().min(1).describe('Name of the category or group'),
  description: z.string().max(150).optional().describe('Brief description of this category'),
  entities: z.array(EntitySchema).min(1).describe('Entities belonging to this category'),
  importance: z.number().min(1).max(10).optional().describe('Overall importance of this category')
});

/**
 * Schema for internal links between nodes
 */
export const InternalLinkSchema = z.object({
  source_node_id: z.string().describe('ID of the source node'),
  target_node_id: z.string().describe('ID of the target node'),
  relationship: z.string().describe('Type of relationship between the nodes'),
  strength: z.number().min(1).max(10).optional().describe('Strength of the relationship (1-10)')
});

/**
 * Schema for relationships between categories or entities
 */
export const RelationshipSchema = z.object({
  source: z.string().describe('Source entity or category name'),
  target: z.string().describe('Target entity or category name'),
  relationship_type: z.string().describe('Type of relationship (e.g., "belongs_to", "influences", "contradicts")'),
  description: z.string().max(100).optional().describe('Brief description of the relationship'),
  strength: z.number().min(1).max(10).optional().describe('Strength of the relationship from 1-10')
});

/**
 * Main schema for structured LLM output
 */
export const StructuredLLMOutputSchema = z.object({
  main_response: z.string().min(1).describe('The primary natural language answer to the user\'s last message'),
  identified_topics: z.array(z.string().min(1))
    .min(1)
    .max(5)
    .optional()
    .describe('List of key topics discussed in the response (3-5 topics)'),
  key_entities: z.array(EntitySchema)
    .max(10)
    .optional()
    .describe('List of individual named entities mentioned in the response'),
  entity_categories: z.array(CategorySchema)
    .optional()
    .describe('Categorized groups of entities when dealing with many similar entities'),
  sentiment: z.enum(['positive', 'negative', 'neutral'])
    .optional()
    .describe('Overall sentiment of the response'),
  suggested_followups: z.array(z.string().min(1))
    .max(3)
    .optional()
    .describe('1-3 relevant follow-up questions the user might ask'),
  internal_links: z.array(InternalLinkSchema)
    .optional()
    .describe('Connections between existing nodes in the graph'),
  relationships: z.array(RelationshipSchema)
    .optional()
    .describe('Defined relationships between entities or categories'),
  summary: z.string()
    .max(200)
    .optional()
    .describe('A very brief (1-2 sentence) summary of the response content')
});

// Type derived from the Zod schema
export type StructuredLLMOutput = z.infer<typeof StructuredLLMOutputSchema>;

/**
 * A simplified version of the schema with basic validation
 * This can be used as a fallback when the strict schema fails
 */
export const SimplifiedLLMOutputSchema = z.object({
  main_response: z.string().min(1),
  identified_topics: z.array(z.string()).optional(),
  key_entities: z.array(z.object({
    entity: z.string(),
    type: z.string(),
    description: z.string().optional(),
    importance: z.number().optional()
  })).optional(),
  entity_categories: z.array(z.object({
    category_name: z.string(),
    description: z.string().optional(),
    entities: z.array(z.object({
      entity: z.string(),
      type: z.string(),
      description: z.string().optional(),
      importance: z.number().optional()
    })),
    importance: z.number().optional()
  })).optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  suggested_followups: z.array(z.string()).optional(),
  relationships: z.array(z.object({
    source: z.string(),
    target: z.string(),
    relationship_type: z.string(),
    description: z.string().optional(),
    strength: z.number().optional()
  })).optional(),
  summary: z.string().optional()
});

// Type derived from the simplified schema
export type SimplifiedLLMOutput = z.infer<typeof SimplifiedLLMOutputSchema>;

/**
 * Generates a human-readable example of the expected structured output format
 * This is used in the system prompt to guide the LLM
 */
export function getStructuredOutputExample(): string {
  // Example for standard responses with a few entities
  const standardExample: StructuredLLMOutput = {
    main_response: "The Pantheon in Rome is renowned for its unique spatial qualities, particularly its large dome and oculus, which create a sense of openness and grandeur. The interior is designed as a perfect sphere, with the height equal to the diameter, enhancing the feeling of balance and harmony. The oculus at the dome's apex not only serves as a source of natural light but also connects the interior with the cosmos, creating a dynamic play of light and shadow throughout the day. The use of various materials and the intricate design of the coffered ceiling contribute to its acoustics and aesthetic appeal.",
    identified_topics: [
      "Pantheon architecture",
      "dome structure",
      "oculus function",
      "interior design",
      "light and shadow"
    ],
    key_entities: [
      { entity: "Pantheon", type: "STRUCTURE", importance: 10, description: "Ancient Roman temple with distinctive dome" },
      { entity: "Rome", type: "LOCATION", importance: 7, description: "Italian capital city where Pantheon is located" },
      { entity: "oculus", type: "ARCHITECTURAL_ELEMENT", importance: 9, description: "Circular opening at the top of the dome" }
    ],
    relationships: [
      { source: "Pantheon", target: "oculus", relationship_type: "contains", strength: 9, description: "The oculus is a key feature of the Pantheon's dome" },
      { source: "oculus", target: "light and shadow", relationship_type: "creates", strength: 8, description: "The oculus creates distinctive lighting effects inside" }
    ],
    sentiment: "positive",
    suggested_followups: [
      "How has the Pantheon influenced modern architecture?",
      "What materials were used in the Pantheon's construction?",
      "How has the Pantheon survived for so long?"
    ],
    summary: "The Pantheon features a perfect spherical design with a distinctive dome and oculus that creates unique lighting effects and spatial harmony."
  };

  // Example for handling large entity lists (like S&P 500 companies)
  const largeEntitiesExample: StructuredLLMOutput = {
    main_response: "The S&P 500 index includes companies from various sectors of the US economy, with technology, healthcare, and financial sectors having the largest representation. These companies meet specific criteria for market capitalization, liquidity, and profitability to be included in the index. The index is designed to reflect the overall US stock market performance and is commonly used as a benchmark for investment performance.",
    identified_topics: [
      "S&P 500 index",
      "market sectors",
      "company classification",
      "market capitalization",
      "investment benchmarks"
    ],
    summary: "The S&P 500 is a diverse index of large US companies across various sectors, primarily dominated by technology, healthcare, and financial businesses.",
    entity_categories: [
      {
        category_name: "Technology Sector",
        description: "Companies that primarily focus on technology products, services, and innovation",
        importance: 10,
        entities: [
          { entity: "Apple", type: "CORPORATION", importance: 10, description: "Consumer electronics and software company" },
          { entity: "Microsoft", type: "CORPORATION", importance: 9, description: "Software and cloud computing company" },
          { entity: "Amazon", type: "CORPORATION", importance: 9, description: "E-commerce and cloud services company" }
        ]
      },
      {
        category_name: "Financial Sector",
        description: "Companies that provide financial services and products",
        importance: 8,
        entities: [
          { entity: "JPMorgan Chase", type: "CORPORATION", importance: 8, description: "Multinational investment bank" },
          { entity: "Bank of America", type: "CORPORATION", importance: 7, description: "Multinational investment bank and financial services company" },
          { entity: "Visa", type: "CORPORATION", importance: 7, description: "Global payments technology company" }
        ]
      },
      {
        category_name: "Healthcare Sector",
        description: "Companies focused on healthcare services, pharmaceuticals, and medical devices",
        importance: 7,
        entities: [
          { entity: "Johnson & Johnson", type: "CORPORATION", importance: 8, description: "Pharmaceutical and consumer goods company" },
          { entity: "UnitedHealth Group", type: "CORPORATION", importance: 7, description: "Health insurance provider" },
          { entity: "Pfizer", type: "CORPORATION", importance: 7, description: "Pharmaceutical company" }
        ]
      }
    ],
    relationships: [
      { source: "Technology Sector", target: "Financial Sector", relationship_type: "correlates_with", strength: 7, description: "Tech and financial sectors often move together in market trends" },
      { source: "S&P 500 index", target: "Technology Sector", relationship_type: "includes", strength: 9, description: "Tech represents the largest portion of the S&P 500" },
      { source: "Healthcare Sector", target: "market capitalization", relationship_type: "contributes_to", strength: 6, description: "Healthcare companies represent significant market cap in the index" }
    ],
    sentiment: "neutral"
  };

  // We'll provide both examples to show different response structures
  // Standard example for typical responses with a few entities
  const standardExampleFormatted = JSON.stringify(standardExample, null, 2);
  
  // Special format for large entity lists
  const largeEntitiesExampleFormatted = JSON.stringify(largeEntitiesExample, null, 2);
  
  return `
// Example for regular queries with few entities:
${standardExampleFormatted}

// Example for large entity lists (like S&P 500 companies):
${largeEntitiesExampleFormatted}
`;
}