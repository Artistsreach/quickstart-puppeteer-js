import { Page } from "puppeteer-core";
import axios from "axios";
import FormData from "form-data";

async function uploadToImgbb(screenshot: string) {
  const formData = new FormData();
  formData.append("image", screenshot);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return response.data.data.url;
}

export async function navigateToUrl(page: Page, url: string) {
  console.log(`Navigating to URL: ${url}`);
  const newUrl = url.startsWith("http") ? url : `https://${url}`;
  await page.goto(newUrl, { waitUntil: "networkidle2", timeout: 120000 });
  const screenshot = await page.screenshot({ encoding: "base64" });
  const screenshotUrl = await uploadToImgbb(screenshot);
  console.log(`Navigation to ${newUrl} successful.`);
  return {
    message: `Navigated to ${newUrl}`,
    screenshot: screenshotUrl,
  };
}

export async function clickElement(page: Page, elementId: string) {
  console.log(`Clicking element with ID: ${elementId}`);

  const browser = page.browser();
  let newPage: Page | null = null;

  const targetCreatedPromise = new Promise<void>((resolve) => {
    browser.once('targetcreated', async (target) => {
      const createdPage = await target.page();
      if (createdPage) {
        newPage = createdPage;
        resolve();
      }
    });
  });

  await page.click(`[data-agent-id="${elementId}"]`);

  let navigationOccurred = false;
  try {
    await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 5000 }),
      targetCreatedPromise,
    ]);
    console.log("Navigation or new tab occurred after click.");
    navigationOccurred = true;
  } catch (error) {
    console.log("No navigation or new tab occurred after click.");
  }

  const pages = await browser.pages();
  if (pages.length === 0) {
    console.log("Clicked element and all pages were closed. Cannot take screenshot.");
    return {
      message: `Clicked on element with ID ${elementId}. Page was closed.`,
      screenshot: null,
      navigationOccurred: true, // Treat as navigation
    };
  }
  const finalPage = newPage || pages[pages.length - 1];

  const screenshot = await finalPage.screenshot({ encoding: "base64" });
  const screenshotUrl = await uploadToImgbb(screenshot);
  console.log(`Clicked element with ID ${elementId} successfully.`);
  return {
    message: `Clicked on element with ID ${elementId}`,
    screenshot: screenshotUrl,
    navigationOccurred,
  };
}

export async function typeText(page: Page, elementId: string, text: string) {
  console.log(`Typing "${text}" into element with ID: ${elementId}`);
  await page.type(`[data-agent-id="${elementId}"]`, text);
  const screenshot = await page.screenshot({ encoding: "base64" });
  const screenshotUrl = await uploadToImgbb(screenshot);
  console.log(`Typed "${text}" into element with ID ${elementId} successfully.`);
  return {
    message: `Typed "${text}" into element with ID ${elementId}`,
    screenshot: screenshotUrl,
  };
}
