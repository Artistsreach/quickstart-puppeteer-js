import { tool } from 'ai';
import { z } from 'zod';

export const clickElementTool = tool({
  description: "Clicks a specific interactive element on the page, such as a button or a link.",
  parameters: z.object({
    elementId: z.string().describe("The ID of the element to click from the provided world model."),
  }),
});

export const typeTextTool = tool({
  description: "Types text into a specific input field, such as a textbox or textarea.",
  parameters: z.object({
    elementId: z.string().describe("The ID of the input element to type into."),
    text: z.string().describe("The text to type."),
  }),
});

export const navigateToUrlTool = tool({
  description: "Navigates the browser to a new, specified URL.",
  parameters: z.object({
    url: z.string().min(1).describe("The full URL to navigate to."),
  }),
});

export const answerTool = tool({
  description: "Provides a final answer to the user when the task is complete or if it cannot be completed.",
  parameters: z.object({
    response: z.string().describe("The final response or confirmation for the user."),
  }),
});
