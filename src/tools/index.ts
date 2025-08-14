import { tool } from 'ai';
import { z } from 'zod';
import { clickElement, navigateToUrl, typeText } from './puppeteer.js';
import { Page } from 'puppeteer-core';
import FirecrawlApp from '@mendable/firecrawl-js';

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

  const firecrawlSearch = tool({
    description:
      'Search the web using Firecrawl and return the top results with metadata. Use this to discover sources to scrape or extract from.',
    parameters: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().min(1).max(25).default(5).describe('Max results to return'),
    }),
    execute: async ({ query, limit }) => {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error('Missing FIRECRAWL_API_KEY');
      const app = new FirecrawlApp({ apiKey });
      const res = await app.search(query, { limit });
      return res;
    },
  });

  const firecrawlScrape = tool({
    description:
      'Scrape a single URL with Firecrawl and return content in requested formats (markdown, html, json, links, screenshot).',
    parameters: z.object({
      url: z.string().url().describe('Page URL to scrape'),
      formats: z
        .array(
          z.enum(['markdown', 'html', 'rawHtml', 'json', 'links', 'screenshot', 'screenshot@fullPage'])
        )
        .default(['markdown'])
        .describe('Output formats to return'),
      jsonPrompt: z
        .string()
        .optional()
        .describe('If formats includes json, provide a prompt for structured extraction'),
    }),
    execute: async ({ url, formats, jsonPrompt }) => {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error('Missing FIRECRAWL_API_KEY');
      const app = new FirecrawlApp({ apiKey });
      const options: any = { formats };
      if (jsonPrompt) options.jsonOptions = { prompt: jsonPrompt };
      const res = await app.scrapeUrl(url, options);
      return res;
    },
  });

  const firecrawlExtract = tool({
    description:
      'Extract structured data from one or multiple URLs (supports wildcards) using Firecrawl. Optionally enable web search expansion.',
    parameters: z.object({
      urls: z.array(z.string()).describe('List of URLs to extract from; can include /* wildcards'),
      prompt: z.string().optional().describe('Natural language extraction prompt'),
      enableWebSearch: z.boolean().optional().describe('Follow related links for richer context'),
      schema: z
        .record(z.any())
        .optional()
        .describe('Optional JSON schema to enforce the output shape'),
    }),
    execute: async ({ urls, prompt, enableWebSearch, schema }) => {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) throw new Error('Missing FIRECRAWL_API_KEY');
      const app = new FirecrawlApp({ apiKey });
      const res = await app.extract(urls, { prompt, enableWebSearch, schema } as any);
      return res;
    },
  });

  const uploadToTaskContext = tool({
    description:
      'Upload relevant data to the shared task context for subsequent steps. Use this after search/scrape/extract to save results.',
    parameters: z.object({
      data: z.any().describe('Arbitrary JSON data to persist in task context'),
      summary: z.string().optional().describe('Short note describing what was added'),
    }),
    execute: async ({ data, summary }) => ({ ok: true, summary, data }),
  });

  const updateTodoList = tool({
    description:
      'Replace or update the current todo list for this task. Use this to plan next steps explicitly as a checklist.',
    parameters: z.object({
      todos: z.array(z.string()).describe('Ordered list of todos to pursue next'),
      note: z.string().optional().describe('Optional note about the plan change'),
    }),
    execute: async ({ todos, note }) => ({ ok: true, todos, note }),
  });

  return {
    clickElement: clickElementTool,
    typeText: typeTextTool,
    navigateToUrl: navigateToUrlTool,
    answer: answerTool,
    firecrawlSearch,
    firecrawlScrape,
    firecrawlExtract,
    uploadToTaskContext,
    updateTodoList,
  };
}
