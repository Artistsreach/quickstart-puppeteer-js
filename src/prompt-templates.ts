export const createExtractionPrompt = (htmlContent: string, userRequest: string): string => {
  return `
You are an elite web data extraction specialist. Your task is to analyze the provided HTML content and extract the information according to the user's request.
You must return the data in a valid JSON format that strictly adheres to the provided schema.

USER REQUEST:
---
${userRequest}
---

HTML CONTENT:
---
${htmlContent}
---
`;
};
