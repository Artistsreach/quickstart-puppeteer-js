import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

app.use(express.static(path.join(__dirname, '../')));
app.use(express.json());

app.post('/api/sessions', async (req, res) => {
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

app.get('/api/sessions', async (req, res) => {
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

app.get('/api/sessions/:id', async (req, res) => {
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

app.get('/api/sessions/:id/debug', async (req, res) => {
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

app.post('/api/sessions/:id/end', async (req, res) => {
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

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
