"use strict";
// // DeepSeekChatModel.ts
// import { BaseChatModel, BaseChatModelCallOptions, AIMessageChunk } from "@langchain/core";
// import axios from "axios";
// export class DeepSeekChatModel extends BaseChatModel {
//   private apiUrl: string;
//   private apiKey: string;
//   constructor(apiUrl: string, apiKey: string) {
//     super();
//     this.apiUrl = apiUrl;
//     this.apiKey = apiKey;
//   }
//   // Override the _call method to fetch response from DeepSeek
//   async _call(messages: string[], options: BaseChatModelCallOptions): Promise<AIMessageChunk[]> {
//     const prompt = messages.join(" "); // Concatenate all messages
//     try {
//       const response = await axios.post(
//         this.apiUrl,
//         { inputs: prompt },
//         { headers: { Authorization: `Bearer ${this.apiKey}` } }
//       );
//       const generatedText = response.data[0]?.generated_text || "No response from the model.";
//       // Return the response in the expected format
//       return [{ text: generatedText }];
//     } catch (error) {
//       console.error("Error getting response from DeepSeek:", error);
//       return [{ text: "Sorry, there was an error processing your request." }];
//     }
//   }
// }
