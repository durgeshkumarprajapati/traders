export const PROJECT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectImage {
  id: string;
  projectId: string;
  imageUrl: string;
  cloudinaryPublicId: string | null;
  altText: string;
  position: number;
}

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  location: string | null;
  completionDate: string | null;
  materialsSupplied: string[];
  brandsSupplied: string[];
  customerTestimonial: string | null;
  customerDisplayName: string | null;
  isAnonymized: boolean;
  authenticityConfirmed: boolean;
  customerConsentObtained: boolean;
  consentRecordedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  status: ProjectStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: ProjectImage[];
}
