import { generateObject, CoreMessage } from 'ai';
import { z } from 'zod';
import { google } from './config.js';

const IntentMapSchema = z.object({
  userIntent: z.string().describe("A summary of the user's likely goal."),
  actionableElements: z.array(
    z.object({
      originalElementId: z
        .string()
        .describe("The original element ID from the world model."),
      elementId: z
        .string()
        .describe(
          "A descriptive ID for the element, e.g., 'search-bar', 'submit-button'."
        ),
      role: z.string(),
      name: z.string(),
      reasoning: z
        .string()
        .describe("Why this element is relevant to the user's intent."),
    })
  ),
  nextBestAction: z
    .string()
    .describe("The suggested next action for the agent."),
  suggestedNextSteps: z
    .array(z.string())
    .describe("A list of suggested next steps for the user."),
});

export async function createIntentMap(prompt: string, worldModel: any) {
  const worldModelForPrompt = { ...worldModel };
  const screenshot = worldModelForPrompt.screenshot;
  delete worldModelForPrompt.screenshot;

  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `
            You are an overseer agent. Your job is to analyze the user's prompt, the screenshot of the page, and the current state of the web page (the "world model") to determine the user's likely intent and suggest the next best action.

            User Prompt: ${prompt}
            World Model:
            ${JSON.stringify(worldModelForPrompt, null, 2)}

            Based on this information, create an intent map that includes a summary of the user's intent, a list of actionable elements, a suggested next best action, and a list of 4 suggested next steps for the user. For each actionable element, provide a descriptive elementId that reflects its function, e.g., 'search-bar', 'submit-button', and include the originalElementId from the world model.
          `,
        },
      ],
    },
  ];

  if (screenshot) {
    (messages[0].content as any[]).push({
      type: 'image',
      image: screenshot,
    });
  }

  const { object: intentMap } = await generateObject({
    model: google('gemini-2.0-flash-exp'),
    schema: IntentMapSchema,
    messages,
  });

  return intentMap;
}

export async function verifyAction(intentMap: any, action: any) {
  const { object: verification } = await generateObject({
    model: google('gemini-2.0-flash-exp'),
    schema: z.object({
      isValid: z.boolean(),
      reasoning: z.string(),
    }),
    prompt: `
      You are an overseer agent. Your job is to verify if the action proposed by the browser automation agent is in line with the user's intent.

      Intent Map:
      ${JSON.stringify(intentMap, null, 2)}

      Proposed Action:
      ${JSON.stringify(action, null, 2)}

      Does this action align with the user's intent and the suggested next best action?
    `,
  });

  return verification;
}
