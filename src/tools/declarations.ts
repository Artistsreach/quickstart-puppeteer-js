import { FunctionDeclaration, Type } from "@google/genai";

export const goToURLDeclaration: FunctionDeclaration = {
  name: "goToURL",
  description: "Navigates the browser to a specified URL.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: "The URL to navigate to." },
    },
    required: ["url"],
  },
};

export const clickElementDeclaration: FunctionDeclaration = {
  name: "clickElement",
  description: "Performs a mouse click on an element on the current page.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description:
          "A standard CSS selector used to uniquely identify the target element to be clicked.",
      },
    },
    required: ["selector"],
  },
};

export const typeInElementDeclaration: FunctionDeclaration = {
  name: "typeInElement",
  description:
    "Types the provided text into a form element like an input field or textarea.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description:
          "A standard CSS selector used to uniquely identify the target input element.",
      },
      text: {
        type: Type.STRING,
        description: "The text to be typed into the element.",
      },
    },
    required: ["selector", "text"],
  },
};

export const extractTextDeclaration: FunctionDeclaration = {
  name: "extractText",
  description:
    "Retrieves the visible text content from a specific element on the page.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      selector: {
        type: Type.STRING,
        description:
          "A standard CSS selector used to uniquely identify the target element from which to extract text.",
      },
    },
    required: ["selector"],
  },
};

export const screenshotDeclaration: FunctionDeclaration = {
  name: "screenshot",
  description: "Takes a screenshot of the current page.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: { type: Type.STRING, description: "The path to save the screenshot to." },
    },
    required: ["path"],
  },
};
