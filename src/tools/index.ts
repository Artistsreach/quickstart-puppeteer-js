import { tool } from 'ai';
import { z } from 'zod';
import { clickElement, navigateToUrl, typeText } from './puppeteer.js';
import { Page } from 'puppeteer-core';

export function createToolSet(page: Page) {
  const clickElementTool = tool({
    description:
      'Clicks a specific interactive element on the page, such as a button or a link. The element must be present in the world model.',
    parameters: z.object({
      elementId: z
        .string()
        .describe(
          'The ID of the element to click, which must be one of the elementIds from the world model.',
        ),
    }),
    execute: async ({ elementId }) => clickElement(page, elementId),
  });

  const typeTextTool = tool({
    description:
      'Types text into a specific input field, such as a textbox or textarea. The element must be present in the world model.',
    parameters: z.object({
      elementId: z
        .string()
        .describe(
          'The ID of the input element to type into, which must be one of the elementIds from the world model.',
        ),
      text: z.string().describe('The text to type into the input field.'),
    }),
    execute: async ({ elementId, text }) => typeText(page, elementId, text),
  });

  const navigateToUrlTool = tool({
    description:
      'Navigates the browser to a new, specified URL. The URL must be a fully qualified URL.',
    parameters: z.object({
      url: z
        .string()
        .describe(
          'The full URL to navigate to, including the protocol (e.g., https://).',
        ),
    }),
    execute: async ({ url }) => navigateToUrl(page, url),
  });

  const answerTool = tool({
    description:
      "Provides a final answer to the user when the task is complete, if the user's query is a question, or if the task cannot be completed.",
    parameters: z.object({
      response: z
        .string()
        .describe('The final response, confirmation, or answer for the user.'),
    }),
    execute: async ({ response }) => response,
  });

  return {
    clickElement: clickElementTool,
    typeText: typeTextTool,
    navigateToUrl: navigateToUrlTool,
    answer: answerTool,
  };
}
