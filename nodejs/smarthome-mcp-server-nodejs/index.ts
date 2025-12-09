#!/usr/bin/env node
/**
 * Smart Home MCP Server
 * 
 * A Model Context Protocol (MCP) server that enables AI assistants (like Claude)
 * to control Matter-compatible smart home devices.
 * 
 * This server implements:
 * - Tools for controlling lights (on, off, toggle, state)
 * - Prompt templates for common smart home interactions
 * - STDIO transport for communication with MCP clients
 * 
 * The server uses the Matter protocol through Matter.js to communicate with
 * smart home devices, providing a bridge between natural language AI interactions
 * and physical device control.
 * 
 * Built using:
 * - @modelcontextprotocol/sdk - Official MCP TypeScript SDK
 * - @matter/nodejs-shell - Matter protocol implementation
 * - zod - Runtime type validation
 * 
 * @module smarthome-mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Import our Matter controller functions
import {
  turnOnLight,
  turnOffLight,
  toggleLight,
  getLightState,
  DEFAULT_LIGHT_NODE_ID,
  DEFAULT_ENDPOINT_ID
} from "./matter-controller.js";

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Create and configure the MCP server instance.
 * 
 * The server name and version are used by MCP clients to identify this server.
 * These values appear in client UIs and logs.
 */
const server = new McpServer({
  name: "smarthome-mcp-server-nodejs",
  version: "1.0.0"
});

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Tool: turn_on_light
 * 
 * Turns the configured Matter light ON.
 * 
 * This tool sends an 'on' command to the Matter device's OnOff cluster,
 * which is the standard Matter cluster for controlling power state.
 * 
 * When called by an AI assistant:
 * - The assistant might say "I'll turn on the light for you"
 * - The tool executes and returns success/failure status
 * - The assistant can then confirm the action to the user
 */
server.registerTool(
  // Tool name - used by the AI to invoke this tool
  "turn_on_light",
  // Tool configuration object with title, description, and schemas
  {
    title: "Turn On Light",
    description: "Turns the smart light ON. Use this when the user wants to turn on, enable, or activate the light.",
    // Input schema - no parameters required, uses configured default light
    inputSchema: {},
    // Output schema - describes the structure of the response
    outputSchema: {
      success: z.boolean().describe("Whether the operation was successful"),
      message: z.string().describe("Human-readable result message"),
      nodeId: z.string().describe("The Matter Node ID of the device"),
      endpointId: z.string().describe("The endpoint ID on the device")
    }
  },
  // Tool handler function
  async () => {
    // Log to stderr (stdout is reserved for MCP protocol communication)
    console.error(`[MCP Server] Tool invoked: turn_on_light`);
    
    // Call our Matter controller function
    const result = await turnOnLight();
    
    // Format the response for the AI
    // The AI will use this information to formulate a response to the user
    if (result.success) {
      const output = {
        success: true,
        message: "Light turned ON successfully",
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Light turned ON successfully.\n\nDevice: Node ${DEFAULT_LIGHT_NODE_ID}, Endpoint ${DEFAULT_ENDPOINT_ID}`
        }],
        structuredContent: output
      };
    } else {
      // Provide detailed error information so the AI can help troubleshoot
      const output = {
        success: false,
        message: `Failed to turn on light: ${result.error}`,
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✗ Failed to turn on light.\n\nError: ${result.error}\n\nTroubleshooting tips:\n- Ensure the light is powered and within range\n- Verify the Node ID (${DEFAULT_LIGHT_NODE_ID}) is correct\n- Check that the device is still commissioned`
        }],
        structuredContent: output,
        isError: true
      };
    }
  }
);

/**
 * Tool: turn_off_light
 * 
 * Turns the configured Matter light OFF.
 * 
 * Similar to turn_on_light but sends an 'off' command instead.
 */
server.registerTool(
  "turn_off_light",
  {
    title: "Turn Off Light",
    description: "Turns the smart light OFF. Use this when the user wants to turn off, disable, or deactivate the light.",
    inputSchema: {},
    outputSchema: {
      success: z.boolean().describe("Whether the operation was successful"),
      message: z.string().describe("Human-readable result message"),
      nodeId: z.string().describe("The Matter Node ID of the device"),
      endpointId: z.string().describe("The endpoint ID on the device")
    }
  },
  async () => {
    console.error(`[MCP Server] Tool invoked: turn_off_light`);
    
    const result = await turnOffLight();
    
    if (result.success) {
      const output = {
        success: true,
        message: "Light turned OFF successfully",
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Light turned OFF successfully.\n\nDevice: Node ${DEFAULT_LIGHT_NODE_ID}, Endpoint ${DEFAULT_ENDPOINT_ID}`
        }],
        structuredContent: output
      };
    } else {
      const output = {
        success: false,
        message: `Failed to turn off light: ${result.error}`,
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✗ Failed to turn off light.\n\nError: ${result.error}\n\nTroubleshooting tips:\n- Ensure the light is powered and within range\n- Verify the Node ID (${DEFAULT_LIGHT_NODE_ID}) is correct\n- Check that the device is still commissioned`
        }],
        structuredContent: output,
        isError: true
      };
    }
  }
);

/**
 * Tool: toggle_light
 * 
 * Toggles the light state (ON → OFF or OFF → ON).
 * 
 * This is useful when:
 * - The user says "switch the light" without specifying on/off
 * - The current state is unknown and the user just wants to change it
 * - Implementing a physical button-like interaction
 */
server.registerTool(
  "toggle_light",
  {
    title: "Toggle Light",
    description: "Toggles the smart light state. If ON, turns it OFF. If OFF, turns it ON. Use this when the user wants to switch or toggle the light without specifying a specific state.",
    inputSchema: {},
    outputSchema: {
      success: z.boolean().describe("Whether the operation was successful"),
      message: z.string().describe("Human-readable result message"),
      nodeId: z.string().describe("The Matter Node ID of the device"),
      endpointId: z.string().describe("The endpoint ID on the device")
    }
  },
  async () => {
    console.error(`[MCP Server] Tool invoked: toggle_light`);
    
    const result = await toggleLight();
    
    if (result.success) {
      const output = {
        success: true,
        message: "Light toggled successfully",
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✓ Light toggled successfully.\n\nDevice: Node ${DEFAULT_LIGHT_NODE_ID}, Endpoint ${DEFAULT_ENDPOINT_ID}\n\nThe light state has been switched. Use 'get_light_state' to check the current state.`
        }],
        structuredContent: output
      };
    } else {
      const output = {
        success: false,
        message: `Failed to toggle light: ${result.error}`,
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✗ Failed to toggle light.\n\nError: ${result.error}\n\nTroubleshooting tips:\n- Ensure the light is powered and within range\n- Verify the Node ID (${DEFAULT_LIGHT_NODE_ID}) is correct\n- Check that the device is still commissioned`
        }],
        structuredContent: output,
        isError: true
      };
    }
  }
);

/**
 * Tool: get_light_state
 * 
 * Retrieves the current state of the light (ON or OFF).
 * 
 * This tool reads the 'onOff' attribute from the device's OnOff cluster.
 * Useful for:
 * - Answering "Is the light on?"
 * - Checking state before deciding what action to take
 * - Confirming a previous action worked
 */
server.registerTool(
  "get_light_state",
  {
    title: "Get Light State",
    description: "Gets the current state of the smart light. Returns whether the light is currently ON or OFF. Use this when the user asks about the light's status or wants to know if it's on.",
    inputSchema: {},
    outputSchema: {
      success: z.boolean().describe("Whether the operation was successful"),
      message: z.string().describe("Human-readable result message"),
      isOn: z.boolean().optional().describe("Current state of the light: true = ON, false = OFF"),
      nodeId: z.string().describe("The Matter Node ID of the device"),
      endpointId: z.string().describe("The endpoint ID on the device")
    }
  },
  async () => {
    console.error(`[MCP Server] Tool invoked: get_light_state`);
    
    const result = await getLightState();
    
    if (result.success) {
      const stateEmoji = result.isOn ? "💡" : "🌑";
      const stateText = result.isOn ? "ON" : "OFF";
      
      const output = {
        success: true,
        message: `Light is currently ${stateText}`,
        isOn: result.isOn,
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `${stateEmoji} Light is currently ${stateText}\n\nDevice: Node ${DEFAULT_LIGHT_NODE_ID}, Endpoint ${DEFAULT_ENDPOINT_ID}`
        }],
        structuredContent: output
      };
    } else {
      const output = {
        success: false,
        message: `Failed to get light state: ${result.error}`,
        isOn: undefined,
        nodeId: DEFAULT_LIGHT_NODE_ID,
        endpointId: DEFAULT_ENDPOINT_ID
      };
      
      return {
        content: [{
          type: "text" as const,
          text: `✗ Failed to get light state.\n\nError: ${result.error}\n\nTroubleshooting tips:\n- Ensure the light is powered and within range\n- The device may be temporarily unreachable\n- Try again in a few moments`
        }],
        structuredContent: output,
        isError: true
      };
    }
  }
);

// ============================================================================
// PROMPT DEFINITIONS
// ============================================================================

/**
 * Prompt: light_control
 * 
 * A template for basic light control interactions.
 * 
 * Prompts in MCP serve as pre-built conversation starters that:
 * - Guide the AI on how to approach a specific type of request
 * - Provide context about available capabilities
 * - Help ensure consistent and helpful responses
 * 
 * Users or AI clients can invoke this prompt to get a structured
 * starting point for light control conversations.
 */
server.registerPrompt(
  // Prompt name - used to invoke this template
  "light_control",
  // Prompt configuration object
  {
    title: "Light Control",
    description: "Template for controlling the smart light",
    // Arguments schema using Zod
    argsSchema: {
      action: z.enum(['on', 'off', 'toggle'])
        .describe("The action to perform: 'on' to turn on, 'off' to turn off, or 'toggle' to switch state")
    }
  },
  // Prompt generator function
  ({ action }) => {
    // Map action to human-readable intent
    const actionDescriptions: Record<string, string> = {
      'on': 'turn on the light',
      'off': 'turn off the light',
      'toggle': 'toggle the light state'
    };
    
    const actionText = actionDescriptions[action] || action;
    
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Please ${actionText}. Let me know when it's done and confirm the action was successful.`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: light_status
 * 
 * A template for checking light status.
 * 
 * This prompt is designed for queries about the current state of the light.
 */
server.registerPrompt(
  "light_status",
  {
    title: "Light Status",
    description: "Template for checking the current light status",
    // No arguments needed - just checking status
    argsSchema: {}
  },
  () => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "What's the current state of the light? Is it on or off? Please check and let me know."
          }
        }
      ]
    };
  }
);

/**
 * Prompt: light_scene
 * 
 * A template for setting up lighting scenes or moods.
 * 
 * While this MCP server currently only supports on/off control,
 * this prompt provides a framework for discussing lighting preferences
 * and could be extended in the future for brightness/color control.
 */
server.registerPrompt(
  "light_scene",
  {
    title: "Light Scene",
    description: "Template for setting up lighting scenes or discussing lighting preferences",
    argsSchema: {
      scene: z.string()
        .describe("The desired scene or mood (e.g., 'movie night', 'reading', 'relaxation', 'bright')")
    }
  },
  ({ scene }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I'd like to set up a "${scene}" lighting scene. Given that you can turn the light on or off, what would you recommend for this scene? Please adjust the light accordingly and explain your choice.`
          }
        }
      ]
    };
  }
);

/**
 * Prompt: light_automation
 * 
 * A template for discussing smart home automation possibilities.
 * 
 * This prompt helps users explore what's possible with their smart lighting
 * and discuss potential automation scenarios.
 */
server.registerPrompt(
  "light_automation",
  {
    title: "Light Automation",
    description: "Template for discussing lighting automation possibilities",
    argsSchema: {
      scenario: z.string()
        .optional()
        .describe("Optional: A specific automation scenario to discuss (e.g., 'bedtime routine', 'motion-based', 'schedule')")
    }
  },
  ({ scenario }) => {
    const scenarioText = scenario 
      ? `specifically about "${scenario}"`
      : "in general";
    
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I'm interested in automating my smart light ${scenarioText}. What are some ways I could automate the light control? What capabilities do you have for controlling the light, and how could these be used in automation scenarios?`
          }
        }
      ]
    };
  }
);

// ============================================================================
// SERVER STARTUP
// ============================================================================

/**
 * Main entry point for the Smart Home MCP Server.
 * 
 * This function:
 * 1. Creates the STDIO transport for MCP communication
 * 2. Connects the server to the transport
 * 3. Handles any startup errors gracefully
 * 
 * The server uses STDIO (standard input/output) for communication,
 * which is the standard transport for MCP servers that run as
 * child processes of MCP clients like Claude Desktop.
 */
async function main(): Promise<void> {
  try {
    // Log startup to stderr (stdout is reserved for MCP protocol)
    console.error("========================================");
    console.error("Smart Home MCP Server Starting...");
    console.error("========================================");
    console.error(`Server Name: smarthome-mcp-server-nodejs`);
    console.error(`Version: 1.0.0`);
    console.error(`Default Light Node ID: ${DEFAULT_LIGHT_NODE_ID}`);
    console.error(`Default Endpoint ID: ${DEFAULT_ENDPOINT_ID}`);
    console.error("----------------------------------------");
    console.error("Available Tools:");
    console.error("  - turn_on_light");
    console.error("  - turn_off_light");
    console.error("  - toggle_light");
    console.error("  - get_light_state");
    console.error("----------------------------------------");
    console.error("Available Prompts:");
    console.error("  - light_control");
    console.error("  - light_status");
    console.error("  - light_scene");
    console.error("  - light_automation");
    console.error("========================================");
    
    // Create the STDIO transport
    // This handles reading from stdin and writing to stdout
    // in the format expected by MCP clients
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    // This starts the server listening for MCP requests
    await server.connect(transport);
    
    console.error("Server connected and ready to receive requests");
    console.error("========================================");
    
  } catch (error) {
    // Log any startup errors
    console.error("Failed to start Smart Home MCP Server:");
    console.error(error);
    
    // Exit with error code
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN HANDLERS
// ============================================================================

/**
 * Handle SIGINT (Ctrl+C) for graceful shutdown.
 * 
 * This ensures the server can clean up resources and
 * close connections properly when terminated.
 */
process.on('SIGINT', () => {
  console.error("\nReceived SIGINT signal");
  console.error("Shutting down Smart Home MCP Server gracefully...");
  process.exit(0);
});

/**
 * Handle SIGTERM for graceful shutdown.
 * 
 * SIGTERM is typically sent by process managers (like systemd)
 * when stopping a service.
 */
process.on('SIGTERM', () => {
  console.error("\nReceived SIGTERM signal");
  console.error("Shutting down Smart Home MCP Server gracefully...");
  process.exit(0);
});

// ============================================================================
// START THE SERVER
// ============================================================================

/**
 * Start the server when this file is executed directly.
 * 
 * This starts the main function and handles any unhandled errors.
 */
main().catch((error) => {
  console.error("Unhandled error during server startup:");
  console.error(error);
  process.exit(1);
});