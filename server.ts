import express, { Request, Response } from 'express';
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import "dotenv/config";
import puppeteer from "puppeteer-core";
import Browserbase from "@browserbasehq/sdk";
import { ai } from "./src/config.js";
import {
  goToURL,
  clickElement,
  typeInElement,
  extractText,
  screenshot,
} from "./src/tools/puppeteer.js";
import {
  clickElementDeclaration,
  extractTextDeclaration,
  goToURLDeclaration,
  screenshotDeclaration,
  typeInElementDeclaration,
} from "./src/tools/declarations.js";

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

  try {
    let session: Session | undefined;
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
      session = (await bb.sessions.create({
        projectId: BROWSERBASE_PROJECT_ID,
      })) as Session;
    }

    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${BROWSERBASE_API_KEY}&sessionId=${session.id}`,
    });

    const pages = await browser.pages();
    const page = pages[0];
    const pageContent = await page.content();

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `This is the current page content: ${pageContent}. Please perform the following task: ${prompt}`,
          },
        ],
      },
    ];

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: {
        tools: [
          {
            functionDeclarations: [
              goToURLDeclaration,
              clickElementDeclaration,
              typeInElementDeclaration,
              extractTextDeclaration,
              screenshotDeclaration,
            ],
          },
        ],
      },
    });

    let currentResult = result;
    while (true) {
      if (
        currentResult.functionCalls &&
        currentResult.functionCalls.length > 0
      ) {
        const functionCall = currentResult.functionCalls[0];
        console.log(`Function to call: ${functionCall.name}`);
        console.log(`Arguments: ${JSON.stringify(functionCall.args)}`);

        let toolResult;
        switch (functionCall.name) {
          case "goToURL":
            toolResult = await goToURL(page, functionCall.args?.url as string);
            break;
          case "clickElement":
            toolResult = await clickElement(
              page,
              functionCall.args?.selector as string
            );
            break;
          case "typeInElement":
            toolResult = await typeInElement(
              page,
              functionCall.args?.selector as string,
              functionCall.args?.text as string
            );
            break;
          case "extractText":
            toolResult = await extractText(
              page,
              functionCall.args?.selector as string
            );
            break;
          case "screenshot":
            toolResult = await screenshot(
              page,
              functionCall.args?.path as string
            );
            break;
          default:
            toolResult = `Unknown tool: ${functionCall.name}`;
        }

        const functionResponsePart = {
          name: functionCall.name,
          response: {
            result: toolResult,
          },
        };

        const pageContent = await page.content();
        const nextRequest = {
          model: "gemini-1.5-flash",
          contents: [
            ...contents,
            { role: "model", parts: [{ functionCall: functionCall }] },
            {
              role: "user",
              parts: [{ functionResponse: functionResponsePart }],
            },
          ],
          config: {
            tools: [
              {
                functionDeclarations: [
                  goToURLDeclaration,
                  clickElementDeclaration,
                  typeInElementDeclaration,
                  extractTextDeclaration,
                  screenshotDeclaration,
                ],
              },
            ],
          },
        };

        currentResult = await ai.models.generateContent(nextRequest);
      } else {
        console.log("No function call found in the response.");
        console.log(currentResult.text);
        break;
      }
    }

    res.json({
      message: `Session complete! View replay at https://browserbase.com/sessions/${session.id}`,
      sessionId: session.id,
      giminiResponse: currentResult.text,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
