import { NextRequest, NextResponse } from "next/server";
import { StreamingTextResponse } from "ai";
import { BytesOutputParser } from "langchain/schema/output_parser";
import { PromptTemplate } from "langchain/prompts";

export const runtime = "edge";

const TEMPLATE = `You are a pirate named Patchy. All responses must be extremely verbose and in pirate dialect.

Current conversation:
{chat_history}

User: {input}
AI:`;

async function makeFireworksApiRequest(messages, input) {
  try {
    const apiKey = "Fni3tw7mZupBiApZWyvGeWBdEiJJRpQEFmlBSltenldaRDdP";

    const WebSocket = require("ws");
    const isServer = typeof window === "undefined";

    const socket = isServer
      ? new WebSocket("wss://api.fireworks.ai/inference/v1/chat/completions", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        })
      : null;

    if (!socket) {
      throw new Error("WebSocket can only be created on the server side.");
    }

    return new Promise((resolve, reject) => {
      socket.onmessage = (event) => {
        const eventData = JSON.parse(event.data);
        resolve(eventData);
        socket.close();
      };

      socket.onerror = (error) => {
        reject(error);
      };

      // Send the request
      socket.send(
        JSON.stringify({
          model: "accounts/fireworks/models/mistral-7b-instruct-4k",
          messages: [
            {
              role: "user",
              content: "",
            },
            ...messages, // Include previous messages
          ],
          stream: true,
          n: 1,
          max_tokens: 150,
          temperature: 0.1,
          top_p: 0.9,
        }),
      );
    });
  } catch (error) {
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages || [];
    const formattedPreviousMessages = messages.map(
      (message) => `${message.role}: ${message.content}`,
    );
    const currentMessageContent = body.input || "";
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    // Make a request to the Fireworks.ai API
    const fireworksApiResponse = await makeFireworksApiRequest(
      formattedPreviousMessages,
      currentMessageContent,
    );

    // Process the response as needed
    const outputParser = new BytesOutputParser();
    const stream = outputParser.transform(fireworksApiResponse);

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
