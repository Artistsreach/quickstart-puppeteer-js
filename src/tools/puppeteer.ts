import { Page } from "puppeteer-core";

export async function navigateToUrl(page: Page, url: string) {
  const newUrl = url.startsWith("http") ? url : `https://${url}`;
  await page.goto(newUrl, { waitUntil: "domcontentloaded" });
  return `Navigated to ${newUrl}`;
}

export async function clickElement(page: Page, elementId: string) {
  await page.click(`[data-agent-id="${elementId}"]`);
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
  return `Clicked on element with ID ${elementId}`;
}

export async function typeText(page: Page, elementId: string, text: string) {
  await page.type(`[data-agent-id="${elementId}"]`, text);
  return `Typed "${text}" into element with ID ${elementId}`;
}
