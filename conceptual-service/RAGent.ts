import { Langbase, Workflow } from "langbase";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

async function mobileOptimizedAssistantWorkflow({ input, env }) {
  const langbase = new Langbase({
    apiKey: env.LANGBASE_API_KEY,
  });

  const { step } = new Workflow({
    debug: true,
  });

  // Generate a unique response ID for tracking async processes
  const responseId = `resp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Step 1: Detect device type from user agent (if provided)
  const deviceType = await step({
    id: "detect_device",
    run: async () => {
      // In a real implementation, this would come from the request headers
      // For this example, we'll assume it's passed in the input or default to "unknown"
      const isMobilePattern = /mobile|android|iphone|ipad|ipod/i;
      const userAgent = env.USER_AGENT || "unknown";
      return isMobilePattern.test(userAgent) ? "mobile" : "desktop";
    },
  });

  // Step 2: Retrieve relevant memories with metadata
  const memories = await step({
    id: "retrieve_memories",
    run: async () => {
      return await langbase.memories.retrieve({
        query: input,
        memory: [{ name: "cognitive-assistant-memory-1746446717518" }],
      });
    },
  });

  // Step 3: Generate immediate response with limited context
  const immediateResponse = await step({
    id: "generate_immediate_response",
    run: async () => {
      // Only use the top 3 most relevant memories to prevent context stuffing
      const topMemories = memories.slice(0, 3);

      const { output } = await langbase.agent.run({
        model: "openai:gpt-4.1-mini",
        apiKey: env.OPENAI_API_KEY,
        instructions: `You are a cognitive assistant that helps users manage information and complete tasks.
        Use the following context from memory (if relevant):
        ${topMemories.map((m, i) => `[Memory ${i + 1}]: ${m.text}`).join("\n\n")}

        Provide a thoughtful, helpful response based on the user's input and available context.
        If the context doesn't seem relevant, rely on your general knowledge instead.

        When referencing information from memory, subtly indicate which memory you're using (e.g., "As previously discussed..." or "Based on your earlier notes...").

        Keep your response concise and well-structured, especially if the user is on a mobile device.`,
        input: [{ role: "user", content: input }],
        stream: false,
      });

      return output;
    },
  });

  // Step 4: Extract topics and entities for visualization (non-blocking)
  // This will run asynchronously and not block the initial response
  const topicsExtractionPromise = step({
    id: "extract_topics",
    run: async () => {
      const topicSchemaZod = z.object({
        mainTopics: z.array(
          z.object({
            name: z.string(),
            category: z.string(),
            importance: z.number().min(1).max(10),
            relatedConcepts: z.array(z.string()),
            sourceType: z.string(), // "query", "response", "memory", or "background"
            briefDescription: z.string(),
          }),
        ),
        suggestedConnections: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            relationshipType: z.string(),
            strength: z.number().min(1).max(10),
          }),
        ),
        existingMemoryReferences: z.array(
          z.object({
            topic: z.string(),
            memoryIndex: z.number(),
            confidence: z.number().min(1).max(10),
          }),
        ),
      });

      const topicSchema = zodToJsonSchema(topicSchemaZod, { target: "openAi" });

      const { output } = await langbase.agent.run({
        model: "openai:gpt-4.1-mini",
        apiKey: env.OPENAI_API_KEY,
        instructions: `Analyze the user query, response, and memory context to extract key topics for visualization.

        User query: ${input}
        Response: ${immediateResponse}
        Memory context: ${memories
          .slice(0, 3)
          .map((m, i) => `[Memory ${i + 1}]: ${m.text}`)
          .join("\n\n")}

        For each main topic:
        1. Provide a clear name (keep it concise)
        2. Categorize it (technology, science, history, art, philosophy, gaming, music, etc.)
        3. Rate its importance (1-10)
        4. List related concepts (keep these concise)
        5. Indicate source type (query, response, memory, or background)
        6. Add a very brief description (15 words or less)

        For connections between topics:
        1. Identify which topics connect to each other
        2. Describe the relationship type
        3. Rate the connection strength (1-10)

        For memory references:
        1. Identify which topics directly reference existing memories
        2. Note which memory index they reference (1, 2, or 3)
        3. Rate the confidence of this connection (1-10)

        ${
          deviceType === "mobile"
            ? "Since this is for mobile display, focus only on the 3-4 most important topics and connections."
            : "Focus on the most important topics and connections (max 7 main topics)."
        }`,
        input: [
          {
            role: "user",
            content: "Extract visualization topics from this conversation.",
          },
        ],
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "VisualizationTopics",
            schema: topicSchema,
            strict: true,
          },
        },
      });

      return JSON.parse(output);
    },
  });

  // Step 5: Evaluate response and generate curation options in a single call
  // This will also run asynchronously
  const evaluationAndCurationPromise = step({
    id: "evaluate_and_curate",
    run: async () => {
      const combinedSchemaZod = z.object({
        evaluation: z.object({
          quality: z.number().min(1).max(10),
          strengths: z.array(z.string()),
          weaknesses: z.array(z.string()),
          suggestedImprovements: z.array(z.string()),
          memoryRelevance: z.number().min(1).max(10),
          shouldStore: z.boolean(),
        }),
        curation: z.object({
          suggestedTags: z.array(z.string()),
          suggestedRelationships: z.array(
            z.object({
              type: z.string(),
              relatedConcept: z.string(),
            }),
          ),
          memoryImportance: z.number().min(1).max(10),
          userActions: z.array(
            z.object({
              action: z.string(),
              description: z.string(),
              reward: z.string(),
              effortLevel: z.number().min(1).max(5),
            }),
          ),
        }),
      });

      const combinedSchema = zodToJsonSchema(combinedSchemaZod, {
        target: "openAi",
      });

      const { output } = await langbase.agent.run({
        model: "openai:gpt-4.1-mini",
        apiKey: env.OPENAI_API_KEY,
        instructions: `Evaluate this response and suggest curation options.

        User query: ${input}
        Response: ${immediateResponse}

        First, evaluate the quality of the response considering accuracy, relevance, completeness, and clarity.

        Then, suggest curation options including:
        1. Relevant tags for categorization (${deviceType === "mobile" ? "3-5" : "5-7"} tags)
        2. Potential relationships to other concepts (${deviceType === "mobile" ? "2-3" : "3-5"} relationships)
        3. An importance score for long-term memory (1-10)
        4. Specific actions the user can take to improve their knowledge base, with clear rewards for each action and an effort level (1-5)

        Determine if this interaction should be stored in memory based on its long-term value.
        Make your suggestions practical and valuable for knowledge organization.

        ${
          deviceType === "mobile"
            ? "Since the user is on a mobile device, keep suggestions concise and prioritize the most important ones."
            : "Provide comprehensive suggestions that would be useful for detailed knowledge organization."
        }`,
        input: [
          {
            role: "user",
            content: "Evaluate this response and suggest curation options.",
          },
        ],
        stream: false,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "EvaluationAndCuration",
            schema: combinedSchema,
            strict: true,
          },
        },
      });

      return JSON.parse(output);
    },
  });

  // Return immediate response with processing status and device type
  const initialResponse = {
    response: immediateResponse,
    responseId: responseId,
    status: "processing",
    timestamp: Date.now(),
    query: input,
    deviceType: deviceType,
    // Include basic visualization placeholder data
    visualizationData: {
      nodes: [],
      edges: [],
      contextSize: memories.length,
      status: "generating",
    },
  };

  // Process topic extraction and convert to visualization format (non-blocking)
  topicsExtractionPromise
    .then((topicsData) => {
      // Convert topics to visualization format using code instead of an LLM call
      const visualizationData = convertTopicsToVisualization(
        topicsData,
        memories,
        deviceType,
      );

      // In a real implementation, this would update a database or cache
      // For this example, we'll log what would be stored
      console.log(
        `[${responseId}] Visualization data ready for ${deviceType}:`,
        JSON.stringify({
          nodes: visualizationData.nodes.length,
          edges: visualizationData.edges.length,
        }),
      );

      // This would be stored in a database or cache for the status endpoint to access
      // simulatedStatusStore[responseId].visualizationData = visualizationData;
      // simulatedStatusStore[responseId].visualizationStatus = "complete";
    })
    .catch((error) => {
      console.error(`[${responseId}] Topic extraction error:`, error);
      // simulatedStatusStore[responseId].visualizationStatus = "error";
    });

  // Process evaluation and curation (non-blocking)
  evaluationAndCurationPromise
    .then((combinedData) => {
      // In a real implementation, this would update a database or cache
      console.log(
        `[${responseId}] Evaluation and curation ready for ${deviceType}`,
      );

      // This would be stored in a database or cache for the status endpoint to access
      // simulatedStatusStore[responseId].evaluation = combinedData.evaluation;
      // simulatedStatusStore[responseId].curationUI = { curationOptions: combinedData.curation };
      // simulatedStatusStore[responseId].status = "complete";
    })
    .catch((error) => {
      console.error(`[${responseId}] Evaluation error:`, error);
      // simulatedStatusStore[responseId].status = "error";
    });

  return initialResponse;
}

// Helper function to convert topics to visualization format optimized for device type
function convertTopicsToVisualization(topicsData, memories, deviceType) {
  const nodes = [];
  const edges = [];
  const nodeMap = {};

  // Color mapping for categories
  const categoryColors = {
    technology: 0x00ff88,
    science: 0x44aaff,
    history: 0xffaa22,
    art: 0xff55dd,
    philosophy: 0xeeeeee,
    gaming: 0xff4444,
    music: 0xcc66ff,
    default: 0xaaaaaa,
  };

  // Source type visual properties
  const sourceTypeProperties = {
    query: { glowIntensity: 1.2, pulseFrequency: 0.5 },
    response: { glowIntensity: 1.0, pulseFrequency: 0.3 },
    memory: { glowIntensity: 0.8, pulseFrequency: 0.2 },
    background: { glowIntensity: 0.6, pulseFrequency: 0.1 },
  };

  // Adjust node size for mobile
  const sizeMultiplier = deviceType === "mobile" ? 1.5 : 1.0;

  // Create nodes from main topics
  topicsData.mainTopics.forEach((topic, index) => {
    const id = `topic-${index}`;
    nodeMap[topic.name] = id;

    const color = categoryColors[topic.category] || categoryColors.default;
    const sourceProps =
      sourceTypeProperties[topic.sourceType] || sourceTypeProperties.background;

    nodes.push({
      id: id,
      label: topic.name,
      category: topic.category,
      size: topic.importance * sizeMultiplier,
      description: topic.briefDescription,
      color: color,
      glowIntensity: sourceProps.glowIntensity,
      pulseFrequency: sourceProps.pulseFrequency,
      sourceType: topic.sourceType,
    });

    // For mobile, limit related concepts to reduce visual complexity
    const relatedConceptsToShow =
      deviceType === "mobile"
        ? topic.relatedConcepts.slice(0, 2)
        : topic.relatedConcepts;

    // Create nodes for related concepts not already in main topics
    relatedConceptsToShow.forEach((concept, conceptIndex) => {
      if (!nodeMap[concept]) {
        const conceptId = `concept-${index}-${conceptIndex}`;
        nodeMap[concept] = conceptId;

        nodes.push({
          id: conceptId,
          label: concept,
          category: topic.category,
          size: Math.max(1, topic.importance - 2) * sizeMultiplier,
          description: `Related to ${topic.name}`,
          color: color,
          glowIntensity: sourceProps.glowIntensity * 0.7,
          pulseFrequency: sourceProps.pulseFrequency * 0.7,
          sourceType: "background",
        });

        // Create edge between main topic and related concept
        edges.push({
          source: id,
          target: conceptId,
          label: "relates to",
          strength: 5,
          width: deviceType === "mobile" ? 2 : 1, // Thicker lines for mobile
        });
      }
    });
  });

  // Create edges from suggested connections
  // For mobile, limit to strongest connections
  const connectionsToShow =
    deviceType === "mobile"
      ? [...topicsData.suggestedConnections]
          .sort((a, b) => b.strength - a.strength)
          .slice(0, 5)
      : topicsData.suggestedConnections;

  connectionsToShow.forEach((connection) => {
    if (nodeMap[connection.from] && nodeMap[connection.to]) {
      edges.push({
        source: nodeMap[connection.from],
        target: nodeMap[connection.to],
        label: connection.relationshipType,
        strength: connection.strength,
        width:
          Math.max(1, Math.min(3, connection.strength / 3)) *
          (deviceType === "mobile" ? 1.5 : 1),
      });
    }
  });

  // Add memory reference indicators
  topicsData.existingMemoryReferences.forEach((ref) => {
    if (
      nodeMap[ref.topic] &&
      ref.memoryIndex >= 0 &&
      ref.memoryIndex < memories.length
    ) {
      const nodeId = nodeMap[ref.topic];
      const node = nodes.find((n) => n.id === nodeId);

      if (node) {
        // Add memory reference to node data
        node.memoryReference = {
          index: ref.memoryIndex,
          confidence: ref.confidence,
          snippet: memories[ref.memoryIndex].text.substring(0, 100) + "...",
        };

        // Increase glow for memory-referenced nodes
        node.glowIntensity *= 1.3;
      }
    }
  });

  // Find the most important node to focus on
  let focusNodeId = null;
  let maxImportance = 0;

  nodes.forEach((node) => {
    if (node.size > maxImportance) {
      maxImportance = node.size;
      focusNodeId = node.id;
    }
  });

  // For mobile, add layout hints
  const layoutHints =
    deviceType === "mobile"
      ? {
          forceStrength: 1.5, // Stronger forces for faster stabilization
          centerGravity: 1.2, // Stronger gravity to center
          nodeSpacing: 120, // More space between nodes
          edgeLength: 150, // Shorter edges
          stabilizationIterations: 50, // Fewer iterations for performance
        }
      : {
          forceStrength: 1.0,
          centerGravity: 1.0,
          nodeSpacing: 80,
          edgeLength: 200,
          stabilizationIterations: 100,
        };

  return {
    nodes,
    edges,
    contextSize: nodes.length + edges.length,
    focusNodeId,
    layoutHints,
    deviceType,
    status: "complete",
  };
}

async function main(event, env) {
  const { input } = await event.json();
  const result = await mobileOptimizedAssistantWorkflow({ input, env });
  return result;
}

export default main;
