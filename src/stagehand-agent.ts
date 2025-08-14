import { Stagehand } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { createIntentMap, verifyAction } from './overseer.js';
import { createWorldModel } from './world-model.js';

export interface StagehandAgentConfig {
  sessionId?: string;
  goal: string;
  maxSteps?: number;
  verbose?: boolean;
}

export interface StagehandAgentResult {
  finalResponse: string;
  intentMap: any;
  sessionId: string;
  debugUrl?: string;
}

export class StagehandAgent {
  private stagehand: Stagehand;
  private history: string[] = [];
  private initialized = false;

  constructor(private config: StagehandAgentConfig) {
    this.stagehand = new Stagehand({
      env: 'BROWSERBASE',
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserbaseSessionID: config.sessionId,
      modelName: 'google/gemini-2.0-flash-exp',
      modelClientOptions: {
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      },
      verbose: config.verbose ? 2 : 0,
      enableCaching: true,
      selfHeal: true,
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    await this.stagehand.init();
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.initialized) {
      await this.stagehand.close();
      this.initialized = false;
    }
  }

  get page() {
    return this.stagehand.page;
  }

  get sessionId(): string {
    return this.stagehand.browserbaseSessionID || '';
  }

  get debugUrl(): string | undefined {
    // Construct debug URL from session ID
    if (this.sessionId) {
      return `https://www.browserbase.com/sessions/${this.sessionId}`;
    }
    return undefined;
  }

  async runAgent(): Promise<StagehandAgentResult> {
    if (!this.initialized) {
      await this.init();
    }

    const maxSteps = this.config.maxSteps || 5;
    const goal = this.config.goal;
    let step = 0;

    console.log(`Starting Stagehand agent with goal: "${goal}"`);

    while (step < maxSteps) {
      try {
        console.log(`\n--- Step ${step + 1}/${maxSteps} ---`);
        
        // Create intent map using current page state
        const intentMap = await this.createIntentMap(goal);
        console.log('Intent map created:', JSON.stringify(intentMap, null, 2));

        // Check if we should navigate to a URL first
        const suggestedUrl = (intentMap as any)?.suggestedUrl as string | undefined;
        if (step === 0 && suggestedUrl) {
          console.log(`Navigating to suggested URL: ${suggestedUrl}`);
          await this.page.goto(suggestedUrl);
          this.history.push(`Step ${step + 1}: Navigated to ${suggestedUrl}`);
        }

        // Get observations of current page
        const observations = await this.page.observe({
          instruction: `Find elements relevant to the goal: ${goal}`,
        });

        if (observations.length === 0) {
          console.log('No actionable elements found on page');
          break;
        }

        // Select the best action based on intent map
        const bestAction = this.selectBestAction(observations, intentMap);
        
        if (!bestAction) {
          console.log('No suitable action found');
          break;
        }

        // Verify action with overseer
        const verification = await this.verifyActionWithOverseer(intentMap, bestAction);
        if (!verification.isValid) {
          console.log(`Action blocked: ${verification.reasoning}`);
          this.history.push(`Step ${step + 1}: Action blocked - ${verification.reasoning}`);
          step++;
          continue;
        }

        // Execute the action
        console.log(`Executing action: ${bestAction.description}`);
        const result = await this.page.act(bestAction);
        
        if (result.success) {
          this.history.push(`Step ${step + 1}: ${result.action} - ${result.message}`);
          console.log(`Action successful: ${result.message}`);
        } else {
          this.history.push(`Step ${step + 1}: Failed - ${result.message}`);
          console.log(`Action failed: ${result.message}`);
        }

        // Check if goal is completed by extracting current state
        const completionCheck = await this.checkGoalCompletion(goal);
        if (completionCheck.completed) {
          console.log('Goal completed!');
          return {
            finalResponse: completionCheck.response,
            intentMap,
            sessionId: this.sessionId,
            debugUrl: this.debugUrl,
          };
        }

        step++;
      } catch (error) {
        console.error(`Error in step ${step + 1}:`, error);
        this.history.push(`Step ${step + 1}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
        step++;
      }
    }

    // Return final result
    const finalIntentMap = await this.createIntentMap(goal);
    return {
      finalResponse: `Agent completed ${step} steps. History: ${this.history.join('; ')}`,
      intentMap: finalIntentMap,
      sessionId: this.sessionId,
      debugUrl: this.debugUrl,
    };
  }

  private async createIntentMap(goal: string) {
    // Use existing overseer logic but adapt for Stagehand
    const currentUrl = this.page.url();
    const pageTitle = await this.page.title();
    
    // Create a simplified world model for the intent map
    const worldModel = {
      url: currentUrl,
      title: pageTitle,
      // We'll let Stagehand handle the detailed element analysis
    };

    return await createIntentMap(goal, worldModel);
  }

  private selectBestAction(observations: any[], intentMap: any) {
    if (!observations.length) return null;

    // Score observations based on intent map priorities
    const scoredActions = observations.map(obs => ({
      ...obs,
      score: this.scoreAction(obs, intentMap),
    }));

    // Sort by score and return the best one
    scoredActions.sort((a, b) => b.score - a.score);
    return scoredActions[0];
  }

  private scoreAction(observation: any, intentMap: any): number {
    let score = 0;
    
    // Higher score for actions that match intent priorities
    if (intentMap.priorities) {
      for (const priority of intentMap.priorities) {
        if (observation.description.toLowerCase().includes(priority.toLowerCase())) {
          score += 10;
        }
      }
    }

    // Higher score for interactive elements
    if (observation.method === 'click') score += 5;
    if (observation.method === 'fill') score += 3;
    
    return score;
  }

  private async verifyActionWithOverseer(intentMap: any, action: any) {
    // Adapt the existing overseer verification logic
    const toolCall = {
      toolName: action.method,
      args: {
        selector: action.selector,
        description: action.description,
        ...action.arguments,
      },
    };

    return await verifyAction(intentMap, toolCall);
  }

  private async checkGoalCompletion(goal: string) {
    try {
      // Use Stagehand's extract to check if goal is completed
      const completion = await this.page.extract({
        instruction: `Based on the current page, determine if this goal has been completed: "${goal}". If completed, provide a summary of what was accomplished.`,
        schema: z.object({
          completed: z.boolean().describe('Whether the goal has been completed'),
          response: z.string().describe('Summary of what was accomplished or current status'),
          confidence: z.number().min(0).max(1).describe('Confidence level (0-1) that the goal is completed'),
        }),
      });

      return completion;
    } catch (error) {
      console.error('Error checking goal completion:', error);
      return {
        completed: false,
        response: 'Unable to determine completion status',
        confidence: 0,
      };
    }
  }
}

// Helper function to create and run a Stagehand agent
export async function runStagehandAgent(config: StagehandAgentConfig): Promise<StagehandAgentResult> {
  const agent = new StagehandAgent(config);
  
  try {
    return await agent.runAgent();
  } finally {
    await agent.close();
  }
}
