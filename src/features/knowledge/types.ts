export const KNOWLEDGE_CATEGORIES = [
  "Cement",
  "TMT Steel",
  "Bricks & Blocks",
  "Sand & Aggregates",
  "Quantity Guidance",
  "Storage & Handling",
  "Purchasing Guide",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export interface KnowledgeArticleTranslation {
  title: string;
  summary: string;
  body: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  summary: string;
  body: string;
  translations: Partial<Record<"hi" | "gu", KnowledgeArticleTranslation>>;
  relatedProductSlugs: string[];
  technicalReviewed: boolean;
  status: KnowledgeStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
