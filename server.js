import express from "express";
import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: "GET,POST",
  })
);

const WALLET_DATA_FILE = "wallet_data.txt";

async function initializeAgent() {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
  let walletDataStr = fs.existsSync(WALLET_DATA_FILE)
    ? fs.readFileSync(WALLET_DATA_FILE, "utf8")
    : null;

  const walletProvider = await CdpWalletProvider.configureWithWallet({
    apiKeyName: process.env.CDP_API_KEY_NAME,
    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    cdpWalletData: walletDataStr || undefined,
    networkId: process.env.NETWORK_ID || "base-sepolia",
  });

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      cdpApiActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      cdpWalletActionProvider({
        apiKeyName: process.env.CDP_API_KEY_NAME,
        apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    ],
  });

  const tools = await getLangChainTools(agentkit);
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: "You are a helpful agent that interacts onchain using CDP AgentKit.",
  });

  fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(await walletProvider.exportWallet()));
  return { agent, config: agentConfig };
}

let agentInstance;
initializeAgent().then(({ agent, config }) => (agentInstance = { agent, config }));

app.post("/chat", async (req, res) => {
  if (!agentInstance) return res.status(500).send("Agent not initialized.");
  try {
    const userMessage = req.body.message;
    const stream = await agentInstance.agent.stream(
      { messages: [new HumanMessage(userMessage)] },
      agentInstance.config
    );
    let response = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) response += chunk.agent.messages[0].content;
      else if ("tools" in chunk) response += chunk.tools.messages[0].content;
    }
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/autonomous", async (req, res) => {
  if (!agentInstance) return res.status(500).send("Agent not initialized.");
  const interval = req.body.interval || 10;
  async function runAutonomous() {
    while (true) {
      try {
        const thought = "Execute an interesting on-chain action.";
        const stream = await agentInstance.agent.stream(
          { messages: [new HumanMessage(thought)] },
          agentInstance.config
        );
        for await (const chunk of stream) {
          console.log(chunk.agent?.messages[0].content || chunk.tools?.messages[0].content);
        }
        await new Promise((resolve) => setTimeout(resolve, interval * 1000));
      } catch (error) {
        console.error("Error in autonomous mode:", error.message);
        break;
      }
    }
  }
  runAutonomous();
  res.json({ message: "Autonomous mode started." });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
