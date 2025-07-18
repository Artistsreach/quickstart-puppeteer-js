import { Page } from "puppeteer-core";

export async function goToURL(page: Page, url: string) {
  const newUrl = url.startsWith("http") ? url : `https://${url}`;
  await page.goto(newUrl, { waitUntil: "domcontentloaded" });
  return `Navigated to ${newUrl}`;
}

export async function clickElement(page: Page, selector: string) {
  await page.click(selector);
  return `Clicked on ${selector}`;
}

export async function typeInElement(page: Page, selector: string, text: string) {
  await page.type(selector, text);
  return `Typed "${text}" into ${selector}`;
}

export async function extractText(page: Page, selector: string) {
  const text = await page.$eval(
    selector,
    (el) => (el as HTMLElement).innerText
  );
  return text;
}

export async function screenshot(page: Page, path: string) {
  await page.screenshot({ path });
  return `Took a screenshot, saved to ${path}`;
}
