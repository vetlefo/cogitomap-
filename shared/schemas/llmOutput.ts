import { z } from 'zod';

/**
 * Schema for entity objects within the structured output
 */
export const EntitySchema = z.object({
  entity: z.string().min(1).describe('The name of the entity'),
  type: z.string().min(1).describe('The type of entity (e.g., PERSON, ORG, LOC, etc.)')
});

/**
 * Schema for internal links between nodes
 */
export const InternalLinkSchema = z.object({
  source_node_id: z.string().describe('ID of the source node'),
  target_node_id: z.string().describe('ID of the target node'),
  relationship: z.string().describe('Type of relationship between the nodes')
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
    .describe('List of named entities mentioned in the response'),
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
    type: z.string()
  })).optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  suggested_followups: z.array(z.string()).optional(),
  summary: z.string().optional()
});

// Type derived from the simplified schema
export type SimplifiedLLMOutput = z.infer<typeof SimplifiedLLMOutputSchema>;

/**
 * Generates a human-readable example of the expected structured output format
 * This is used in the system prompt to guide the LLM
 */
export function getStructuredOutputExample(): string {
  const example: StructuredLLMOutput = {
    main_response: "The Pantheon in Rome is renowned for its unique spatial qualities, particularly its large dome and oculus, which create a sense of openness and grandeur. The interior is designed as a perfect sphere, with the height equal to the diameter, enhancing the feeling of balance and harmony. The oculus at the dome's apex not only serves as a source of natural light but also connects the interior with the cosmos, creating a dynamic play of light and shadow throughout the day. The use of various materials and the intricate design of the coffered ceiling contribute to its acoustics and aesthetic appeal.",
    identified_topics: [
      "Pantheon architecture",
      "dome structure",
      "oculus function",
      "interior design",
      "light and shadow"
    ],
    key_entities: [
      { entity: "Pantheon", type: "STRUCTURE" },
      { entity: "Rome", type: "LOCATION" },
      { entity: "oculus", type: "ARCHITECTURAL_ELEMENT" }
    ],
    sentiment: "positive",
    suggested_followups: [
      "How has the Pantheon influenced modern architecture?",
      "What materials were used in the Pantheon's construction?",
      "How has the Pantheon survived for so long?"
    ],
    summary: "The Pantheon features a perfect spherical design with a distinctive dome and oculus that creates unique lighting effects and spatial harmony."
  };

  return JSON.stringify(example, null, 2);
}