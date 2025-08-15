import puppeteer, { Browser, Page } from 'puppeteer-core';

export type BrowserbaseSession = {
  id: string;
  debugUrl?: string;
};

export async function createBrowserbaseSession(keepAlive = true): Promise<BrowserbaseSession> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error('Missing BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID');
  }

  const res = await fetch('https://api.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: {
      'x-bb-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, keepAlive }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browserbase session create failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return { id: data.id, debugUrl: data.debugUrl };
}

export async function connectPuppeteerToBrowserbase(sessionId: string): Promise<{ browser: Browser; page: Page }>{
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) throw new Error('Missing BROWSERBASE_API_KEY');

  const wsUrl = `wss://connect.browserbase.com?apiKey=${apiKey}&sessionId=${sessionId}`;
  const browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });

  // Prefer first page if exists; otherwise create new one.
  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  return { browser, page };
}
