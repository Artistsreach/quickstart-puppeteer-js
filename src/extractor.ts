import { Page } from 'puppeteer-core';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z, ZodType } from 'zod';
import { createExtractionPrompt } from './prompt-templates.js';

export async function extractData<T extends ZodType>(
  page: Page,
  userRequest: string,
  schema: T
): Promise<z.infer<T>> {
  console.log(`Extracting data for request: "${userRequest}"`);

  const htmlContent = await page.content();
  const prompt = createExtractionPrompt(htmlContent, userRequest);

  const { object } = await generateObject({
    model: google('gemini-1.5-flash-latest'),
    schema,
    prompt,
  });

  return object;
}
