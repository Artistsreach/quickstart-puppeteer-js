import puppeteer from 'puppeteer-core';
import Browserbase from '@browserbasehq/sdk';
import 'dotenv/config';
import { initializeMastraWithAgent } from './agent/browser-agent';
import readline from 'readline/promises';

async function main() {
  if (!process.env.BROWSERBASE_API_KEY ||!process.env.BROWSERBASE_PROJECT_ID) {
    throw new Error('Browserbase API Key or Project ID is not set.');
  }

  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY,
  });

  let session;
  let browser;
  try {
    console.log('Creating Browserbase session...');
    session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
    });
    browser = await puppeteer.connect({ browserWSEndpoint: session.browserWSEndpoint });
    const page = await browser.newPage();
    console.log('Browser connected.');

    const mastra = initializeMastraWithAgent();
    const agent = await mastra.getAgent('browser');
    console.log('Browser Agent initialized. Ready for prompts. Type "exit" to quit.');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    let messages: any[] = [];

    while (true) {
      const prompt = await rl.question('\n> ');
      if (prompt.toLowerCase() === 'exit') break;

      messages.push({ role: 'user', content: prompt });

      const { text, toolCalls, toolResults } = await agent.generate(messages);
      
      if (toolCalls && toolCalls.length > 0) {
        console.log('[Agent Activity] Tools called:', toolCalls);
      }
      if (toolResults && toolResults.length > 0) {
        console.log('[Agent Activity] Tool results:', toolResults);
      }

      console.log(`\n🤖 Agent: ${text}`);

      messages.push({ role: 'assistant', content: text, toolCalls });
    }
    rl.close();

  } catch (error) {
    console.error('A critical error occurred:', error);
  } finally {
    if (browser) await browser.close();
    console.log('\nApplication finished.');
  }
}

main();
