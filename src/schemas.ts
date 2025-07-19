import { z } from 'zod';

export const ArticleSchema = z.object({
  headline: z.string().describe("The main title or headline of the article."),
  summary: z.string().describe("A brief one-sentence summary, subtitle, or lede of the article."),
  url: z.string().url().describe("The full, absolute URL link to the article."),
});

export const ArticleListSchema = z.object({
  articles: z.array(ArticleSchema),
});
