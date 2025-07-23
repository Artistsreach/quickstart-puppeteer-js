import { Page } from 'puppeteer-core';

export interface InteractiveElement {
  elementId: string;
  role: string;
  name: string;
  value?: string;
  description?: string;
}

export async function createWorldModel(
  page: Page,
  screenshot?: string,
  intentMap?: any,
): Promise<any> {
  const interactiveElements = await page.$$eval(
    'a, button, input, textarea, select',
    (elements, intentMap) => {
      const generateId = (el: Element) => {
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase().replace(/\s+/g, '-');
        const id = el.id ? `-id-${el.id}` : '';
        return `${role}-${name}${id}`.slice(0, 50);
      };

      return elements.map((el, index) => {
        let elementId = generateId(el) || `interactive-element-${index}`;
        if (intentMap) {
          const mappedElement = intentMap.actionableElements.find(
            (e: any) => e.originalElementId === elementId
          );
          if (mappedElement) {
            elementId = mappedElement.elementId;
          }
        }
        el.setAttribute('data-agent-id', elementId); // Tag the element in the DOM

        return {
          elementId,
          role: el.getAttribute('role') || el.tagName.toLowerCase(),
          name: (el.getAttribute('aria-label') || el.textContent || '').trim(),
          value: 'value' in el ? (el as any).value : undefined,
        };
      });
    },
    intentMap
  );

  const pageContent = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => h.textContent?.trim());
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.href,
    }));
    return {
      title: document.title,
      headings,
      links,
    };
  });

  return {
    ...pageContent,
    interactiveElements,
    screenshot,
  };
}
