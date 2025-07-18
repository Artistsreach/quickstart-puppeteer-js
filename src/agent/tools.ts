import { tool } from 'ai';
import { z } from 'zod';
import type { Page } from 'puppeteer-core';

export const browserTools = {
  navigateToPage: tool({
    description: 'Navigates the browser to the provided URL. Call this first to start a task.',
    parameters: z.object({
      url: z.string().url().describe('The fully qualified URL to navigate to (e.g., https://www.example.com).'),
    }),
    execute: async ({ url }, { page }: { page: Page }) => {
      try {
        console.log(` Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        const title = await page.title();
        return `Successfully navigated to ${url}. Page title: "${title}"`;
      } catch (error) {
        console.error(` Failed to navigate:`, error);
        return `Error: Failed to navigate to ${url}. The URL may be invalid or the page is unreachable.`;
      }
    },
  }),

  clickElement: tool({
    description: 'Clicks an interactive element on the page, such as a button, link, or tab, specified by a CSS selector.',
    parameters: z.object({
      selector: z.string().describe('A valid CSS selector for the element to click.'),
    }),
    execute: async ({ selector }, { page }: { page: Page }) => {
      try {
        console.log(` Clicking element with selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.click(selector);
        return `Successfully clicked the element with selector "${selector}".`;
      } catch (error) {
        console.error(` Failed to click element:`, error);
        return `Error: Could not find or click the element with selector "${selector}". It may not exist or is not clickable.`;
      }
    },
  }),

  typeInElement: tool({
    description: 'Types the given text into an input field, textarea, or other form element specified by a CSS selector.',
    parameters: z.object({
      selector: z.string().describe('A CSS selector for the input field.'),
      text: z.string().describe('The text to type into the element.'),
    }),
    execute: async ({ selector, text }, { page }: { page: Page }) => {
      try {
        console.log(` Typing "${text}" into selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.type(selector, text);
        return `Successfully typed text into the element with selector "${selector}".`;
      } catch (error) {
        console.error(` Failed to type in element:`, error);
        return `Error: Could not find or type in the element with selector "${selector}".`;
      }
    },
  }),

  extractTextContent: tool({
    description: 'Extracts and returns the visible text content from a single element specified by a CSS selector. Useful for reading specific pieces of information from the page.',
    parameters: z.object({
      selector: z.string().describe('A CSS selector for the element from which to extract text.'),
    }),
    execute: async ({ selector }, { page }: { page: Page }) => {
      try {
        console.log(` Extracting text from selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 5000 });
        const textContent = await page.$eval(selector, el => el.textContent);
        return textContent?.trim() || 'No text content found.';
      } catch (error) {
        console.error(` Failed to extract text:`, error);
        return `Error: Could not find the element with selector "${selector}" to extract text from.`;
      }
    },
  }),

  scrollPage: tool({
    description: 'Scrolls the page either "up" or "down" to reveal more content, especially for pages with infinite scrolling.',
    parameters: z.object({
      direction: z.enum(['up', 'down']).describe('The direction to scroll.'),
    }),
    execute: async ({ direction }, { page }: { page: Page }) => {
      try {
        console.log(` Scrolling page ${direction}...`);
        await page.evaluate((dir) => {
          const scrollAmount = window.innerHeight * 0.8;
          window.scrollBy(0, dir === 'down'? scrollAmount : -scrollAmount);
        }, direction);
        return `Successfully scrolled page ${direction}.`;
      } catch (error) {
        console.error(` Failed to scroll:`, error);
        return `Error: An unexpected error occurred while trying to scroll the page.`;
      }
    },
  }),
};
