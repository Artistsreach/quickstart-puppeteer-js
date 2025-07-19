import { createGoogleGenerativeAI } from '@ai-sdk/google';
import 'dotenv/config';

export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});
