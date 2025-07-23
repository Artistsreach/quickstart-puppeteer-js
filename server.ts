import express, { Request, Response } from 'express';
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import puppeteer, { Page } from "puppeteer-core";
import { Browserbase } from "@browserbasehq/sdk";
import {
  generateText,
  NoSuchToolError,
  InvalidToolArgumentsError,
  ToolExecutionError,
} from 'ai';
import { GoogleGenAI } from "@google/genai";
import FirecrawlApp from '@mendable/firecrawl-js';
import { google } from './src/config.js';
import { createWorldModel } from './src/world-model.js';
import { createIntentMap, verifyAction } from './src/overseer.js';
import { createToolSet } from './src/tools/index.js';
import { extractData } from './src/extractor.js';
import { ArticleListSchema } from './src/schemas.js';

interface Session {
  id: string;
  [key: string]: any;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

app.use(express.static(path.join(__dirname, '../'), { index: false }));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../experiment.html'));
});

app.post('/api/sessions', async (req: Request, res: Response) => {
    if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
        return res.status(400).json({ error: 'Missing API key or project ID.' });
    }
    try {
        const response = await fetch('https://api.browserbase.com/v1/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BB-API-Key': BROWSERBASE_API_KEY,
            },
            body: JSON.stringify({
                projectId: BROWSERBASE_PROJECT_ID,
                keepAlive: true,
            }),
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/sessions', async (req: Request, res: Response) => {
    if (!BROWSERBASE_API_KEY) {
        return res.status(400).json({ error: 'Missing API key.' });
    }
    try {
        const response = await fetch('https://api.browserbase.com/v1/sessions', {
            headers: {
                'X-BB-API-Key': BROWSERBASE_API_KEY,
            },
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/sessions/:id', async (req: Request, res: Response) => {
    if (!BROWSERBASE_API_KEY) {
        return res.status(400).json({ error: 'Missing API key.' });
    }
    try {
        const response = await fetch(`https://api.browserbase.com/v1/sessions/${req.params.id}`, {
            headers: {
                'X-BB-API-Key': BROWSERBASE_API_KEY,
            },
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post('/api/sessions/:id/end', async (req: Request, res: Response) => {
    if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
        return res.status(400).json({ error: 'Missing API key or project ID.' });
    }
    try {
        const response = await fetch(`https://api.browserbase.com/v1/sessions/${req.params.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BB-API-Key': BROWSERBASE_API_KEY,
            },
            body: JSON.stringify({
                projectId: BROWSERBASE_PROJECT_ID,
                status: 'REQUEST_RELEASE',
            }),
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.get('/api/sessions/:id/debug', async (req: Request, res: Response) => {
    if (!BROWSERBASE_API_KEY) {
        return res.status(400).json({ error: 'Missing API key.' });
    }
    try {
        const response = await fetch(`https://api.browserbase.com/v1/sessions/${req.params.id}/debug`, {
            headers: {
                'X-BB-API-Key': BROWSERBASE_API_KEY,
            },
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

let history: string[] = [];

app.post("/api/start", (req: Request, res: Response) => {
  history = [];
  res.json({ message: "Session started." });
});

async function runAgent(page: Page, goal: string): Promise<{
  finalResponse: string;
  intentMap: any;
}> {
  const maxSteps = 5;
  let step = 0;
  let screenshot: string | undefined;
  const model = google('gemini-2.0-flash-exp');

  console.log(`Starting agent with goal: ${goal}`);

  while (step < maxSteps) {
    try {
      const toolSet = createToolSet(page);
      const intentMap = await createIntentMap(goal, await createWorldModel(page, step > 0 ? screenshot : undefined));
      const worldModel = await createWorldModel(
        page,
        step > 0 ? screenshot : undefined,
        intentMap
      );

      const prompt = `
        You are an expert puppeteer tool calling browser automation agent. Your goal is to complete the tasks requested by the user and execute subsequential steps based on their overall goal, previous history of actions and overseer intent map.
        You are currently on the web page: ${page.url()}
        Overall Goal: ${goal}
        History of actions taken:
        ${history.join('\n')}
        Overseer's Intent Map:
        ${JSON.stringify(intentMap, null, 2)}

        Based on the goal, the history of actions, the current page state, and the overseer's intent map, what is the next single action to take? Execute this action. If you have completed the task, use the "answer" tool to respond.
      `;

      console.log(`Step ${step + 1}: Generating action...`);
      const { toolCalls, toolResults, text, finishReason } = await generateText({
        model,
        tools: toolSet,
        prompt,
        maxRetries: 2,
        experimental_repairToolCall: async ({ toolCall, error, messages }) => {
          if (NoSuchToolError.isInstance(error)) {
            console.log('Tool not found, skipping repair.');
            return null;
          }
          console.log(
            `Attempting to repair tool call: ${toolCall.toolName}`,
            `Error: ${error.message}`,
          );
          const result = await generateText({
            model,
            messages: [
              ...messages,
              {
                role: 'assistant',
                content: [
                  {
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args,
                  },
                ],
              },
              {
                role: 'tool',
                content: [
                  {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    result: error.message,
                  },
                ],
              },
            ],
            tools: toolSet,
          });
          const newToolCall = result.toolCalls.find(
            (tc) => tc.toolName === toolCall.toolName,
          );

          return newToolCall != null
            ? {
                toolCallType: 'function' as const,
                toolCallId: toolCall.toolCallId,
                toolName: newToolCall.toolName,
                args: JSON.stringify(newToolCall.args),
              }
            : null;
        },
      });

      console.log(`Finish reason: ${finishReason}`);

      if (toolCalls.length === 0) {
        console.log(`LLM provided a text response: ${text}.`);
        history.push(`LLM Response: ${text}`);
        if (step === maxSteps - 1) return { finalResponse: text, intentMap };
        step++;
        continue;
      }

      for (const toolCall of toolCalls) {
        console.log('Tool call: ', toolCall);
        if (toolCall.toolName === 'answer') {
          return { finalResponse: toolCall.args.response, intentMap };
        }

        const verification = await verifyAction(intentMap, toolCall);
        if (!verification.isValid) {
          const reason = `Action not approved by overseer: ${verification.reasoning}`;
          console.log(reason);
          history.push(`Step ${step + 1}: Action blocked. Reason: ${reason}`);
          continue;
        }

        const action = `${toolCall.toolName}(${JSON.stringify(toolCall.args)})`;
        history.push(`Step ${step + 1}: ${action}`);
        console.log(`Executing: ${action}`);
      }

      for (const toolResult of toolResults) {
        console.log('Tool result:', toolResult);
        screenshot = (toolResult.result as any).screenshot;
      }

      const pages = await page.browser().pages();
      page = pages[pages.length - 1];
    } catch (error) {
      console.error('Error during agent execution:', error);
      if (error instanceof NoSuchToolError) {
        const errorMessage = `Error: Tool not found for call: ${error.toolName}`;
        console.error(errorMessage);
        history.push(errorMessage);
      } else if (error instanceof InvalidToolArgumentsError) {
        const errorMessage = `Error: Invalid arguments for tool: ${error.toolName}. Details: ${error.message}`;
        console.error(errorMessage);
        history.push(errorMessage);
      } else if (error instanceof ToolExecutionError) {
        const errorMessage = `Error: Failed to execute tool: ${error.toolName}. Details: ${error.message}`;
        console.error(errorMessage);
        history.push(errorMessage);
      } else {
        const errorMessage = 'An unexpected error occurred during agent execution.';
        console.error(errorMessage, error);
        history.push(errorMessage);
      }
      return {
        finalResponse: 'An error occurred during agent execution.',
        intentMap: null,
      };
    }
    step++;
  }
  return {
    finalResponse: 'Agent finished after maximum steps.',
    intentMap: null,
  };
}

app.post("/api/suggestions", async (req: Request, res: Response) => {
  const { prompt, sessionId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    return res.status(400).json({ error: "Missing API key or project ID." });
  }

  const bb = new Browserbase({
    apiKey: BROWSERBASE_API_KEY,
  });

  let session: Session | undefined;
  let browser;

  try {
    if (sessionId) {
      const response = await fetch(
        `https://api.browserbase.com/v1/sessions/${sessionId}`,
        {
          headers: {
            "X-BB-API-Key": BROWSERBASE_API_KEY,
          },
        }
      );
      if (response.ok) {
        session = (await response.json()) as Session;
      }
    }

    if (!session) {
      session = await bb.sessions.create({
        projectId: BROWSERBASE_PROJECT_ID,
        keepAlive: true,
      });
    }

    browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });

    const pages = await browser.pages();
    const page = pages[0];

    const intentMap = await createIntentMap(prompt, await createWorldModel(page));

    res.json({
      intentMap,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/command", async (req: Request, res: Response) => {
  const { prompt, sessionId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    return res.status(400).json({ error: "Missing API key or project ID." });
  }

  const bb = new Browserbase({
    apiKey: BROWSERBASE_API_KEY,
  });

  let session: Session | undefined;
  let browser;

  try {
    if (sessionId) {
      const response = await fetch(
        `https://api.browserbase.com/v1/sessions/${sessionId}`,
        {
          headers: {
            "X-BB-API-Key": BROWSERBASE_API_KEY,
          },
        }
      );
      if (response.ok) {
        session = (await response.json()) as Session;
      }
    }

    if (!session) {
      session = await bb.sessions.create({
        projectId: BROWSERBASE_PROJECT_ID,
        keepAlive: true,
      });
    }

    browser = await puppeteer.connect({
      browserWSEndpoint: session.connectUrl,
    });

    const pages = await browser.pages();
    const page = pages[0];

    const { finalResponse, intentMap } = await runAgent(page, prompt);

    res.json({
      message: finalResponse || `Task “[${prompt}]” Complete!`,
      sessionId: session.id,
      intentMap,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/search', async (req: Request, res: Response) => {
    const { query } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Missing query.' });
    }

    if (!FIRECRAWL_API_KEY) {
        return res.status(400).json({ error: 'Missing Firecrawl API key.' });
    }

    try {
        const app = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });
        const searchResult = await app.search(query, { limit: 5 });
        res.json(searchResult);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

app.post("/api/extract", async (req: Request, res: Response) => {
    const { url, userRequest } = req.body;

    if (!url || !userRequest) {
        return res.status(400).json({ error: "Missing url or userRequest." });
    }

    if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
        return res.status(400).json({ error: "Missing API key or project ID." });
    }

    const bb = new Browserbase({
        apiKey: BROWSERBASE_API_KEY,
    });

    let session: Session | undefined;
    let browser;

    try {
        session = await bb.sessions.create({
            projectId: BROWSERBASE_PROJECT_ID,
        });

        browser = await puppeteer.connect({
            browserWSEndpoint: session.connectUrl,
        });

        const pages = await browser.pages();
        const page = pages[0];

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const result = await extractData(
            page,
            userRequest,
            ArticleListSchema
        );

        res.json({
            message: `Task “[${userRequest}]” Complete!`,
            sessionId: session.id,
            data: result,
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    } finally {
        if (browser) {
            await browser.disconnect();
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
