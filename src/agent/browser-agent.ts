import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { llm } from './config';
import { browserTools } from './tools';
import type { Page } from 'puppeteer-core';

const createBrowserAgent = () => {
  return new Agent({
    name: 'browser',
    model: llm,
    tools: browserTools,
    instructions: `You are an expert web automation assistant...`,
  });
};

export const initializeMastraWithAgent = () => {
  const browserAgent = createBrowserAgent();
  
  const mastra = new Mastra({
    agents: {
      browser: browserAgent,
    },
  });

  return mastra;
};
