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
Object.defineProperty(exports, "__esModule", { value: true });
const cdp_agentkit_core_1 = require("@coinbase/cdp-agentkit-core");
const cdp_langchain_1 = require("@coinbase/cdp-langchain");
const langgraph_1 = require("@langchain/langgraph");
const prebuilt_1 = require("@langchain/langgraph/prebuilt");
const ollama_1 = require("@langchain/ollama");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
dotenv.config();
// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";
/**
 * Initialize the agent with CDP AgentKit
 *
 * @returns Agent executor and config
 */
function initializeAgent() {
    return __awaiter(this, void 0, void 0, function* () {
        // Initialize LLM using OllamaLLM
        const llm = new ollama_1.ChatOllama({
            model: "llama3", // Use the desired model
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
        // Create React Agent using the LLM and CDP AgentKit tools
        const agent = (0, prebuilt_1.createReactAgent)({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit...",
        });
        // Save wallet data
        const exportedWallet = yield agentkit.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);
        return { agent, config: agentConfig };
    });
}
