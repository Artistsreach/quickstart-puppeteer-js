import express, { Request, Response } from 'express';
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import puppeteer, { Page } from "puppeteer-core";
import { Browserbase } from "@browserbasehq/sdk";
import { generateText } from 'ai';
import { GoogleGenAI } from "@google/genai";
import { google } from './src/config.js';
import { createWorldModel } from './src/world-model.js';
import {
  clickElementTool,
  typeTextTool,
  navigateToUrlTool,
  answerTool,
} from './src/tools/declarations.js';
import {
  clickElement,
  typeText,
  navigateToUrl,
} from './src/tools/puppeteer.js';
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

app.use(express.static(path.join(__dirname, '../')));
app.use(express.json());

app.get('/experiment', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../experiment.html'));
});

app.post('/api/quick-response', async (req: Request, res: Response) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                thinkingConfig: {
                    thinkingBudget: 0, // Disables thinking
                },
            }
        });
        res.json({ message: response.text });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
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

async function runAgent(page: Page, goal: string) {
  let lastAction = 'Initial goal';

  const worldModel = await createWorldModel(page);
  const prompt = `
    You are a browser automation agent. Your goal is to complete the task requested by the user.
    You are currently on the page: ${page.url()}
    Overall Goal: ${goal}
    Previous Action: ${lastAction}
    Current Page World Model (Interactive Elements):
    ${JSON.stringify(worldModel, null, 2)}

    Based on the goal and the current page state, what is the next single action to take?
  `;

  try {
    const { toolCalls, text } = await generateText({
      model: google('gemini-2.0-flash-exp'),
      tools: { clickElement: clickElementTool, typeText: typeTextTool, navigateToUrl: navigateToUrlTool, answer: answerTool },
      prompt,
    });

    if (toolCalls.length === 0) {
      console.log(`LLM provided a text response: ${text}.`);
      return;
    }

    for (const toolCall of toolCalls) {
      lastAction = `${toolCall.toolName}(${JSON.stringify(toolCall.args)})`;
      console.log(`Executing: ${lastAction}`);

      switch (toolCall.toolName) {
        case 'clickElement': {
          const { elementId } = toolCall.args;
          await clickElement(page, elementId);
          break;
        }
        case 'typeText': {
          const { elementId, text: textToType } = toolCall.args;
          await typeText(page, elementId, textToType);
          break;
        }
        case 'navigateToUrl': {
            const { url } = toolCall.args;
            await navigateToUrl(page, url);
            break;
        }
        case 'answer': {
          console.log(`Agent answered: ${toolCall.args.response}`);
          break;
        }
      }
    }
  } catch (error) {
    console.error("Error during agent execution:", error);
  }
}

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

    await runAgent(page, prompt);

    res.json({
      message: `Task “[${prompt}]” Complete!`,
      sessionId: session.id,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (browser) {
      await browser.disconnect();
    }
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
