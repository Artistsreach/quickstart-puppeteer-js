import { createGoogleGenerativeAI } from '@ai-sdk/google';
import 'dotenv/config';

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set in the environment variables.');
}

const google = createGoogleGenerativeAI();

export const llm = google('models/gemini-1.5-pro-latest');
