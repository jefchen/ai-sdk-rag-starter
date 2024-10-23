import { createResource } from '@/lib/actions/resources';
import { openai } from '@ai-sdk/openai';
import { convertToCoreMessages, streamText, tool } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/ai/embedding';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;


export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system: `
      You are a helpful assistant. \n
      1) When prompted with a question, check your knowledge base before answering any questions. Only respond to questions using information from tool calls. If no relevant information is found in the tool calls, respond, "Sorry, I don't know." \n
      2) When promoted with any other statements, store the user input in your knowledge base.
      `,
    messages: convertToCoreMessages(messages),
    tools: {
      getDateToday: tool({
        description: `get both the current date and time.`,
        parameters: z.object({}),
        execute: async () => {
          const result = new Date().toISOString();
          console.log("get the current time result", result);
          return result;
        },
      }),
      addResource: tool({
        description: `add a resource to your knowledge base.
          If the user provides a random piece of knowledge unprompted, use this tool without asking for confirmation.`,
        parameters: z.object({
          content: z
            .string()
            .describe('the content or resource to add to the knowledge base'),
        }),
        execute: async ({ content }) => createResource({ content }),
      }),
      getInformation: tool({
        description: `get information from your knowledge base to answer questions.`,
        parameters: z.object({
          question: z.string().describe('the users question'),
        }),
        execute: async ({ question }) => findRelevantContent(question),
      }),
    },

  });

  return result.toDataStreamResponse();
}