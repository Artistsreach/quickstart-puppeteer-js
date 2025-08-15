import { generateText, NoSuchToolError } from 'ai';
import { google } from '@ai-sdk/google';
import type { Page } from 'puppeteer-core';
import { createSimpleToolset } from './simple-tools.js';

export type SimpleAgentResult = {
  finalText: string;
  steps: Array<{ step: number; action: string; result?: any; error?: string }>;
};

/**
 * Simple multi-step automation loop.
 * - Uses Google via Vercel AI SDK for single tool call per step.
 * - Requires the model to validate completion using `assert`/`getContent` before moving on.
 * - Terminates when `answer` tool is called or max steps reached.
 */
export async function runSimpleAgent(page: Page, goal: string, opts?: { maxSteps?: number }): Promise<SimpleAgentResult> {
  const maxSteps = opts?.maxSteps ?? 8;
  const steps: SimpleAgentResult['steps'] = [];
  const model = google('gemini-2.5-flash');

  let finalText = '';

  for (let step = 1; step <= maxSteps; step++) {
    const tools = createSimpleToolset(page);

    const prompt = `You are a precise browser automation agent using a limited toolset.
Goal: ${goal}
Current URL: ${page.url()}

Rules:
- Propose EXACTLY one tool call at a time.
- Prefer: navigate -> type -> press -> click -> waitFor -> assert -> getContent (to validate progress).
- After each action, if relevant, call assert/getContent to verify success before planning the next step.
- When the overall goal is achieved, call the answer tool with the final result.
- Be specific with selectors, prefer stable attributes (name, aria-label) over brittle nth-child.

Hints for common sites:
- If on bestbuy.com, the search input may be one of: #gh-search-input, [name="st"], [data-testid="SearchInput"], or input[type="search"]. If typing into a search input, submit with press({ key: "Enter", selector: "input[type=\"search\"]" });
`;

    try {
      const { toolCalls, toolResults, text } = await generateText({
        model,
        prompt,
        tools,
        maxRetries: 1,
        experimental_repairToolCall: async ({ toolCall, error, messages }) => {
          if (NoSuchToolError.isInstance(error)) return null;
          // Re-feed the error so model can adjust args
          const retry = await generateText({ model, messages, tools });
          const newTc = retry.toolCalls.find((tc) => tc.toolName === toolCall.toolName);
          return newTc
            ? { toolCallType: 'function' as const, toolCallId: toolCall.toolCallId, toolName: newTc.toolName, args: JSON.stringify(newTc.args) }
            : null;
        },
      });

      // Capture last tool call summary for logging
      const action = toolCalls?.[0]
        ? `${toolCalls[0].toolName}(${JSON.stringify(toolCalls[0].args)})`
        : 'no-tool';

      // If the model returned direct text and no tools, keep iterating but log it
      if (!toolCalls?.length && text) {
        steps.push({ step, action, result: { text } });
        // If model claims finished without using answer, break conservatively
        if (/done|completed|finished/i.test(text)) break;
        continue;
      }

      // Evaluate tool result
      const result = toolResults?.[0]?.result;
      steps.push({ step, action, result });

      // If the tool was the final answer
      if (result?.data?.final === true && typeof result.data.text === 'string') {
        finalText = result.data.text;
        break;
      }

      // Small wait between steps to allow page to settle
      await new Promise((r) => setTimeout(r, 400));
    } catch (err: any) {
      steps.push({ step, action: 'error', error: err?.message ?? String(err) });
      // Try to recover by continuing unless repeated
      continue;
    }
  }

  if (!finalText) {
    // Provide a fallback summary using page state
    const title = await page.title().catch(() => '');
    const url = page.url();
    finalText = `Completed ${steps.length} steps. Current page: ${title} (${url}).`;
  }

  return { finalText, steps };
}
