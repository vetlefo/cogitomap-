// server/mcp/mcpClient.ts
import type {
McpTool,
McpToolCallResponse,
McpResource,
McpResourceResponse,
} from "../../src/types"; // Adjust path as necessary if src/types.ts moves or server/mcp is deeper

// Only 7 verbs cover 95 % of use-cases; you can grow later without breaking UI.
export interface CogitoMcpClient {
connect(serverName: string): Promise<void>;
disconnect(serverName?: string): Promise<void>; // null ➞ all
listTools(serverName: string): Promise<McpTool[]>;
callTool(
serverName: string,
tool: string,
args?: Record<string, unknown>,
): Promise<McpToolCallResponse>;

listResources(serverName: string): Promise<McpResource[]>;
readResource(serverName: string, uri: string): Promise<McpResourceResponse>;

onServerEvent(
cb: (evt: {
server: string;
status: "connected" | "connecting" | "disconnected";
error?: string;
}) => void,
): () => void; // returns "unsubscribe"
}