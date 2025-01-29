"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const cdp_agentkit_core_1 = require("@coinbase/cdp-agentkit-core");
const cdp_langchain_1 = require("@coinbase/cdp-langchain");
const messages_1 = require("@langchain/core/messages");
const langgraph_1 = require("@langchain/langgraph");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
const openai_1 = require("openai"); // Import the Hugging Face OpenAI client
dotenv.config();
/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment() {
    const missingVars = [];
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
function initializeAgent() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Initialize Hugging Face API client (acting as your LLM)
            const client = new openai_1.OpenAI({
                baseURL: "https://huggingface.co/api/inference-proxy/together",
                apiKey: process.env.HUGGINGFACE_API_KEY || "hf_xxxxxxxxxxxxxxxxxxxxxxxx",
            });
            let walletDataStr = null;
            // Read existing wallet data if available
            if (fs.existsSync(WALLET_DATA_FILE)) {
                try {
                    walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
                }
                catch (error) {
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
            const agentkit = yield cdp_agentkit_core_1.CdpAgentkit.configureWithWallet(config);
            // Initialize CDP AgentKit Toolkit and get tools
            const cdpToolkit = new cdp_langchain_1.CdpToolkit(agentkit);
            const tools = cdpToolkit.getTools();
            // Store buffered conversation history in memory
            const memory = new langgraph_1.MemorySaver();
            const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };
            // Define a method to call the Hugging Face model
            const getChatCompletion = (userInput) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const chatCompletion = yield client.chat.completions.create({
                        model: "deepseek-ai/DeepSeek-V3",
                        messages: [
                            { role: "user", content: userInput },
                        ],
                        max_tokens: 500,
                    });
                    return chatCompletion.choices[0].message;
                }
                catch (error) {
                    console.error("Error getting chat completion:", error);
                    return "Sorry, something went wrong.";
                }
            });
            // Create a custom agent that uses Hugging Face for LLM
            const agent = {
                stream: (args, config) => __awaiter(this, void 0, void 0, function* () {
                    const userMessage = args.messages[0].content;
                    const aiResponse = yield getChatCompletion(userMessage);
                    return [
                        { agent: { messages: [{ content: aiResponse }] } },
                        { tools: { messages: [{ content: "No tools needed." }] } },
                    ];
                }),
            };
            // Save wallet data
            const exportedWallet = yield agentkit.exportWallet();
            fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);
            return { agent, config: agentConfig };
        }
        catch (error) {
            console.error("Failed to initialize agent:", error);
            throw error; // Re-throw to be handled by caller
        }
    });
}
/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runChatMode(agent, config) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        console.log("Starting chat mode... Type 'exit' to end.");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const userInput = yield question("\nPrompt: ");
                if (userInput.toLowerCase() === "exit") {
                    break;
                }
                const stream = yield agent.stream({ messages: [new messages_1.HumanMessage(userInput)] }, config);
                try {
                    for (var _d = true, stream_1 = (e_1 = void 0, __asyncValues(stream)), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                        _c = stream_1_1.value;
                        _d = false;
                        const chunk = _c;
                        if ("agent" in chunk) {
                            console.log(chunk.agent.messages[0].content);
                        }
                        else if ("tools" in chunk) {
                            console.log(chunk.tools.messages[0].content);
                        }
                        console.log("-------------------");
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
        }
        catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            }
            process.exit(1);
        }
        finally {
            rl.close();
        }
    });
}
/**
 * Run the agent autonomously based on predefined prompts or periodic triggers
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
function runAutonomousMode(agent, config) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_2, _b, _c;
        const predefinedMessage = "Be creative and do something interesting on the blockchain. Choose an action or set of actions and execute it that highlights your abilities.";
        console.log("Starting autonomous mode...");
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        try {
            // Send the predefined message to the agent
            const stream = yield agent.stream({ messages: [new messages_1.HumanMessage(predefinedMessage)] }, config);
            try {
                for (var _d = true, stream_2 = __asyncValues(stream), stream_2_1; stream_2_1 = yield stream_2.next(), _a = stream_2_1.done, !_a; _d = true) {
                    _c = stream_2_1.value;
                    _d = false;
                    const chunk = _c;
                    if ("agent" in chunk) {
                        console.log("Agent Response: ", chunk.agent.messages[0].content);
                    }
                    else if ("tools" in chunk) {
                        console.log("Tool Response: ", chunk.tools.messages[0].content);
                    }
                    console.log("-------------------");
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_2.return)) yield _b.call(stream_2);
                }
                finally { if (e_2) throw e_2.error; }
            }
            console.log("Autonomous mode finished.");
        }
        catch (error) {
            console.error("Error in autonomous mode:", error);
        }
    });
}
/**
 * Ask the user to choose the mode (interactive or autonomous) using 1 and 2
 *
 * @returns {Promise<string>} User's mode choice
 */
function askUserForMode() {
    return __awaiter(this, void 0, void 0, function* () {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));
        const mode = yield question("Choose mode: (1) Interactive (2) Autonomous: ");
        rl.close();
        return mode.trim();
    });
}
/**
 * Start the chatbot agent
 */
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { agent, config } = yield initializeAgent();
            let mode = yield askUserForMode();
            while (mode !== "exit") {
                if (mode === "1") {
                    yield runChatMode(agent, config);
                }
                else if (mode === "2") {
                    yield runAutonomousMode(agent, config);
                }
                else {
                    console.log("Invalid mode. Please choose either '1' for Interactive or '2' for Autonomous.");
                }
                mode = yield askUserForMode();
            }
            console.log("Exiting...");
        }
        catch (error) {
            if (error instanceof Error) {
                console.error("Error:", error.message);
            }
            process.exit(1);
        }
    });
}
if (require.main === module) {
    console.log("Starting Agent...");
    main().catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}
