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
import axios from 'axios';
import { marked } from 'marked';
import { runSimpleAgent } from './src/simple-agent.js';

const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

app.use(express.static('public'));
app.use(express.json());

app.post('/api/logo-and-plan', async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    if (!BRAVE_API_KEY || !GEMINI_API_KEY) {
        return res.status(400).json({ error: 'Missing API keys.' });
    }

    try {
        // Fetch logo from Brave Image Search
        const imageSearchResponse = await axios.get('https://api.search.brave.com/res/v1/images/search', {
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': BRAVE_API_KEY
            },
            params: { q: `${prompt} logo`, count: 1 }
        });

        const logoUrl = imageSearchResponse.data.results[0]?.thumbnail.src;

        // Generate automation plan with Gemini
        const model = google('gemini-2.5-flash-lite');
        const { text } = await generateText({
            model,
            prompt: `Create a step-by-step automation plan for: ${prompt}. The plan should be in Markdown format. For any integration or tool mentioned (like Zapier, Slack, etc.), use a placeholder in the format [LOGO: "tool name"].`
        });

        // Find all logo placeholders
        const logoPlaceholders = text.match(/\[LOGO: "([^"]+)"\]/g) || [];
        let processedText = text;

        for (const placeholder of logoPlaceholders) {
            const toolNameMatch = placeholder.match(/\[LOGO: "([^"]+)"\]/);
            if (toolNameMatch && toolNameMatch[1]) {
                const toolName = toolNameMatch[1];
                try {
                    const toolLogoResponse = await axios.get('https://api.search.brave.com/res/v1/images/search', {
                        headers: {
                            'Accept': 'application/json',
                            'X-Subscription-Token': BRAVE_API_KEY
                        },
                        params: { q: `${toolName} logo`, count: 1 }
                    });
                    const toolLogoUrl = toolLogoResponse.data.results[0]?.thumbnail.src;
                    if (toolLogoUrl) {
                        const markdownImage = `![${toolName} logo](${toolLogoUrl})`;
                        processedText = processedText.replace(placeholder, markdownImage);
                    } else {
                        // If no logo found, just remove the placeholder
                        processedText = processedText.replace(placeholder, '');
                    }
                } catch (e) {
                    console.error(`Failed to fetch logo for ${toolName}`, e);
                    // If fetching fails, remove the placeholder
                    processedText = processedText.replace(placeholder, '');
                }
            }
        }

        const plan = `<h2>${prompt} Plan</h2><img src="${logoUrl}" alt="${prompt} logo" class="main-logo" /><br/>${marked(processedText)}`;

        res.json({ plan });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});


app.post('/api/sessions', async (req: Request, res: Response) => {
  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    return res.status(400).json({ error: 'Missing API key or project ID.' });
  }
  try {
    const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });
    const session = await bb.sessions.create({
      projectId: BROWSERBASE_PROJECT_ID,
      keepAlive: true,
      browserSettings: {
        viewport: { width: 1440, height: 900 },
      },
    });
    res.json(session);
  } catch (error: any) {
    console.error('Session creation failed:', error?.response?.data || error?.message || error);
    return res.status(500).json({
      error: 'Failed to create session',
      details: error?.response?.data || error?.message || String(error),
    });
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
  const model = google('gemini-2.5-flash-lite');

  // Shared task context and todo list across steps
  let taskContext: any = { sources: [], notes: [] };
  let todos: string[] = [];

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
        You are an expert puppeteer tool-calling automation agent.
        Use a todo list and a shared task context to plan and execute.

        Current URL: ${page.url()}
        Overall Goal: ${goal}
        History:
        ${history.join('\n')}
        Overseer's Intent Map:
        ${JSON.stringify(intentMap, null, 2)}
        Todo List (you can update via updateTodoList):
        ${JSON.stringify(todos)}
        Task Context (you can add to via uploadToTaskContext):
        ${JSON.stringify(taskContext, null, 2)}

        Guidelines:
        - For web research or data gathering, prefer Firecrawl tools:
          * firecrawlSearch(query, limit)
          * firecrawlScrape(url, formats[, jsonPrompt])
          * firecrawlExtract(urls[, prompt, enableWebSearch, schema])
          * uploadToTaskContext(data[, summary]) to persist findings
          * updateTodoList(todos[, note]) to maintain an explicit plan
        - For browser interaction inside the current session, use:
          * clickElement, typeText, navigateToUrl
        - If the task is complete, use the "answer" tool to respond succinctly.

        Decide the next single action and execute it now.
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

        // Only verify DOM-interaction actions with overseer
        const requiresVerification = ['clickElement', 'typeText', 'navigateToUrl'].includes(toolCall.toolName);
        if (requiresVerification) {
          const verification = await verifyAction(intentMap, toolCall);
          if (!verification.isValid) {
            const reason = `Action not approved by overseer: ${verification.reasoning}`;
            console.log(reason);
            history.push(`Step ${step + 1}: Action blocked. Reason: ${reason}`);
            continue;
          }
        }

        const action = `${toolCall.toolName}(${JSON.stringify(toolCall.args)})`;
        history.push(`Step ${step + 1}: ${action}`);
        console.log(`Executing: ${action}`);
      }

      for (const toolResult of toolResults) {
        console.log('Tool result:', toolResult);
        const name = toolResult.toolName;
        const result: any = toolResult.result as any;

        if (name === 'uploadToTaskContext' && result) {
          // Merge data and keep a note
          if (result.data !== undefined) taskContext.sources.push(result.data);
          if (result.summary) taskContext.notes.push(result.summary);
        } else if (name === 'updateTodoList' && result?.todos) {
          todos = Array.isArray(result.todos) ? result.todos : todos;
          if (result.note) taskContext.notes.push(`Plan: ${result.note}`);
        } else if (name === 'firecrawlSearch' || name === 'firecrawlScrape' || name === 'firecrawlExtract') {
          // Auto-store Firecrawl outputs into context for convenience
          taskContext.sources.push({ tool: name, output: result });
        }

        if (result && result.screenshot) {
          screenshot = result.screenshot;
        }
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

// Simple agent route: smaller multi-step loop with verification per step
app.post("/api/simple-command", async (req: Request, res: Response) => {
  const { prompt, sessionId, maxSteps } = req.body as { prompt: string; sessionId?: string; maxSteps?: number };

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt." });
  }

  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    return res.status(400).json({ error: "Missing API key or project ID." });
  }

  const bb = new Browserbase({ apiKey: BROWSERBASE_API_KEY });

  let session: Session | undefined;
  let browser;

  try {
    if (sessionId) {
      const response = await fetch(
        `https://api.browserbase.com/v1/sessions/${sessionId}`,
        { headers: { "X-BB-API-Key": BROWSERBASE_API_KEY } }
      );
      if (response.ok) session = (await response.json()) as Session;
    }

    if (!session) {
      session = await bb.sessions.create({ projectId: BROWSERBASE_PROJECT_ID, keepAlive: true });
    }

    browser = await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
    const pages = await browser.pages();
    const page = pages[0];

    const result = await runSimpleAgent(page, prompt, { maxSteps });

    res.json({
      message: result.finalText,
      steps: result.steps,
      sessionId: session.id,
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
        console.log(`Using Firecrawl API Key: ${FIRECRAWL_API_KEY.substring(0, 5)}...${FIRECRAWL_API_KEY.slice(-4)}`);
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
