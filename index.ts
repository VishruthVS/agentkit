import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpToolkit } from "@coinbase/cdp-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { OpenAI } from "openai"; // Import the Hugging Face OpenAI client

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize Hugging Face API client (acting as your LLM)
    const client = new OpenAI({
      baseURL: "https://huggingface.co/api/inference-proxy/together",
      apiKey: process.env.HUGGINGFACE_API_KEY || "hf_xxxxxxxxxxxxxxxxxxxxxxxx",
    });

    let walletDataStr: string | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
        // Continue without wallet data
      }
    }

    // Configure CDP AgentKit
    const config = {
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    // Initialize CDP AgentKit
    const agentkit = await CdpAgentkit.configureWithWallet(config);

    // Initialize CDP AgentKit Toolkit and get tools
    const cdpToolkit = new CdpToolkit(agentkit);
    const tools = cdpToolkit.getTools();

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    // Define a method to call the Hugging Face model
    const getChatCompletion = async (userInput: string) => {
      try {
        const chatCompletion = await client.chat.completions.create({
          model: "deepseek-ai/DeepSeek-V3",
          messages: [
            { role: "user", content: userInput },
          ],
          max_tokens: 500,
        });
        return chatCompletion.choices[0].message;
      } catch (error) {
        console.error("Error getting chat completion:", error);
        return "Sorry, something went wrong.";
      }
    };

    // Create a custom agent that uses Hugging Face for LLM
    const agent = {
      stream: async (args: any, config: any) => {
        const userMessage = args.messages[0].content;
        const aiResponse = await getChatCompletion(userMessage);
        return [
          { agent: { messages: [{ content: aiResponse }] } },
          { tools: { messages: [{ content: "No tools needed." }] } },
        ];
      },
    };

    // Save wallet data
    const exportedWallet = await agentkit.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Run the agent autonomously based on predefined prompts or periodic triggers
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
async function runAutonomousMode(agent: any, config: any) {
  const predefinedMessage =
    "Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities.";

  console.log("Starting autonomous mode...");

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // Send the predefined message to the agent
    const stream = await agent.stream({ messages: [new HumanMessage(predefinedMessage)] }, config);

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        console.log("Agent Response: ", chunk.agent.messages[0].content);
      } else if ("tools" in chunk) {
        console.log("Tool Response: ", chunk.tools.messages[0].content);
      }
      console.log("-------------------");
    }

    console.log("Autonomous mode finished.");
  } catch (error) {
    console.error("Error in autonomous mode:", error);
  }
}

/**
 * Ask the user to choose the mode (interactive or autonomous) using 1 and 2
 *
 * @returns {Promise<string>} User's mode choice
 */
async function askUserForMode(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  const mode = await question("Choose mode: (1) Interactive (2) Autonomous: ");
  rl.close();

  return mode.trim();
}

/**
 * Start the chatbot agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();

    let mode = await askUserForMode();

    while (mode !== "exit") {
      if (mode === "1") {
        await runChatMode(agent, config);
      } else if (mode === "2") {
        await runAutonomousMode(agent, config);
      } else {
        console.log("Invalid mode. Please choose either '1' for Interactive or '2' for Autonomous.");
      }

      mode = await askUserForMode();
    }

    console.log("Exiting...");

  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
