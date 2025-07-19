import { Page } from 'puppeteer-core';

export interface InteractiveElement {
  elementId: string;
  role: string;
  name: string;
  value?: string;
}

export async function createWorldModel(page: Page): Promise<InteractiveElement[]> {
  return page.$$eval('a, button, input, textarea, select', (elements) => {
    return elements.map((el, index) => {
      const elementId = `interactive-element-${index}`;
      el.setAttribute('data-agent-id', elementId); // Tag the element in the DOM

      return {
        elementId,
        role: el.getAttribute('role') || el.tagName.toLowerCase(),
        name: (el.getAttribute('aria-label') || el.textContent || '').trim(),
        value: 'value' in el ? (el as any).value : undefined,
      };
    });
  });
}
