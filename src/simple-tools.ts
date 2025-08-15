import { tool } from 'ai';
import type { Page } from 'puppeteer-core';
import { z } from 'zod';

export type ToolExecuteResult = {
  ok: boolean;
  message?: string;
  data?: any;
};

export function createSimpleToolset(page: Page) {
  // Helpers scoped to this page
  const getHost = () => {
    try { return new URL(page.url()).host; } catch { return ''; }
  };

  const maybeDismissOverlays = async () => {
    // Best-effort; ignore errors
    const candidates = [
      '#onetrust-accept-btn-handler', // OneTrust cookie banner
      'button#onetrust-accept-btn-handler',
      'button[aria-label="Close"]',
      'button.c-close-icon',
      'button[aria-label="Close Dialog"]',
      'button[data-modal="close"]',
      'button[data-testid="close-button"]',
    ];
    for (const sel of candidates) {
      const el = await page.$(sel);
      if (el) {
        try {
          await page.click(sel).catch(() => {});
          await new Promise((r) => setTimeout(r, 300));
        } catch {}
      }
    }
  };

  const resolveSelector = async (selector: string): Promise<string> => {
    // If provided selector exists, use it
    const exists = await page.$(selector);
    if (exists) return selector;

    const host = getHost();
    const fallbacks: string[] = [];

    if (/bestbuy\.com$/.test(host)) {
      // Common Best Buy search input selectors
      fallbacks.push(
        'input#gh-search-input',
        'input[name="st"]',
        'input[data-testid="SearchInput"]',
        'input[type="search"]'
      );
    }

    for (const fb of fallbacks) {
      const el = await page.$(fb);
      if (el) return fb;
    }
    return selector; // fallback to original
  };

  return {
    navigate: tool({
      description: 'Navigate the page to a given URL and wait for DOM to be loaded.',
      parameters: z.object({ url: z.string() }),
      execute: async ({ url }: { url: string }): Promise<ToolExecuteResult> => {
        try {
          let target = url.trim();
          if (!/^https?:\/\//i.test(target)) {
            target = `https://${target}`;
          }
          // Set a sane timeout for navigation
          page.setDefaultNavigationTimeout(30000);
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await maybeDismissOverlays();
          const current = page.url();
          return { ok: true, message: `Navigated to ${current}` };
        } catch (err: any) {
          // Retry via window.location.assign as a fallback
          try {
            await page.evaluate((u) => window.location.assign(u), url);
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await maybeDismissOverlays();
            return { ok: true, message: `Navigated via fallback to ${page.url()}` };
          } catch (err2: any) {
            return { ok: false, message: `Navigation failed: ${err?.message || err}. Fallback error: ${err2?.message || err2}` };
          }
        }
      },
    }),

    click: tool({
      description: 'Click an element by CSS selector.',
      parameters: z.object({ selector: z.string() }),
      execute: async ({ selector }: { selector: string }): Promise<ToolExecuteResult> => {
        await maybeDismissOverlays();
        const sel = await resolveSelector(selector);
        await page.waitForSelector(sel, { timeout: 25000, visible: true });
        await page.click(sel);
        return { ok: true, message: `Clicked ${sel}` };
      },
    }),

    type: tool({
      description: 'Type text into an input field by CSS selector (clears existing value).',
      parameters: z.object({ selector: z.string(), text: z.string() }),
      execute: async ({ selector, text }: { selector: string; text: string }): Promise<ToolExecuteResult> => {
        await maybeDismissOverlays();
        const sel = await resolveSelector(selector);
        await page.waitForSelector(sel, { timeout: 25000, visible: true });
        await page.click(sel, { clickCount: 3 });
        await page.type(sel, text, { delay: 20 });
        return { ok: true, message: `Typed into ${sel}` };
      },
    }),

    waitFor: tool({
      description: 'Wait for a selector to appear or disappear.',
      parameters: z.object({ selector: z.string(), state: z.enum(['visible', 'hidden']).default('visible') }),
      execute: async (
        { selector, state }: { selector: string; state: 'visible' | 'hidden' },
      ): Promise<ToolExecuteResult> => {
        await maybeDismissOverlays();
        const sel = await resolveSelector(selector);
        if (state === 'visible') {
          await page.waitForSelector(sel, { visible: true, timeout: 30000 });
        } else {
          await page.waitForSelector(sel, { hidden: true, timeout: 30000 });
        }
        return { ok: true, message: `Waited for ${sel} to be ${state}` };
      },
    }),

    assert: tool({
      description: 'Assert that a selector exists or page contains text.',
      parameters: z.object({ selector: z.string().optional(), text: z.string().optional() }).refine(v => v.selector || v.text, {
        message: 'Provide selector or text',
      }),
      execute: async (
        { selector, text }: { selector?: string; text?: string },
      ): Promise<ToolExecuteResult> => {
        if (selector) {
          const el = await page.$(selector);
          if (!el) return { ok: false, message: `Selector not found: ${selector}` };
        }
        if (text) {
          const content = await page.evaluate(() => document.body.innerText);
          if (!content || !content.toLowerCase().includes(text.toLowerCase())) {
            return { ok: false, message: `Text not found: ${text}` };
          }
        }
        return { ok: true, message: 'Assertion passed' };
      },
    }),

    getContent: tool({
      description: 'Return current URL, title, and visible text snapshot.',
      parameters: z.object({ maxChars: z.number().int().positive().max(20000).default(4000) }),
      execute: async ({ maxChars }: { maxChars: number }): Promise<ToolExecuteResult> => {
        const url = page.url();
        const title = await page.title();
        const text = await page.evaluate(() => document.body.innerText.slice(0, 20000));
        const content = text.slice(0, maxChars);
        return { ok: true, data: { url, title, content } };
      },
    }),

    answer: tool({
      description: 'Return final answer and end the run.',
      parameters: z.object({ text: z.string() }),
      execute: async ({ text }: { text: string }): Promise<ToolExecuteResult> => {
        return { ok: true, data: { final: true, text } };
      },
    }),

    press: tool({
      description: 'Press a keyboard key. Optionally focus a selector first.',
      parameters: z.object({ key: z.string(), selector: z.string().optional() }),
      execute: async ({ key, selector }: { key: string; selector?: string }): Promise<ToolExecuteResult> => {
        await maybeDismissOverlays();
        if (selector) {
          const sel = await resolveSelector(selector);
          await page.waitForSelector(sel, { timeout: 20000, visible: true });
          await page.click(sel);
        }
        await page.keyboard.press(key as any);
        return { ok: true, message: `Pressed ${key}${selector ? ` after focusing ${selector}` : ''}` };
      },
    }),
  } as const;
}
