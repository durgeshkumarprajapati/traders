import { z } from "zod";
import { HONEYPOT_FIELD } from "@/features/enquiries/submission-schemas";
import { mobileSchema, optionalEmail, text } from "@/features/enquiries/schemas";

export const EXPERT_TOPICS = [
  "CONCRETE_MASONRY",
  "STEEL_REINFORCEMENT",
  "PLUMBING_ELECTRICAL",
  "FINISHING_PAINT",
  "TOOLS_HARDWARE",
  "OTHER",
] as const;
export type ExpertTopic = (typeof EXPERT_TOPICS)[number];

export const EXPERT_TOPIC_LABELS: Record<ExpertTopic, string> = {
  CONCRETE_MASONRY: "Cement, concrete & masonry",
  STEEL_REINFORCEMENT: "Steel & reinforcement",
  PLUMBING_ELECTRICAL: "Plumbing & electrical",
  FINISHING_PAINT: "Finishing & paint",
  TOOLS_HARDWARE: "Tools & hardware",
  OTHER: "Something else",
};

export const EXPERT_PROJECT_TYPES = [
  "NEW_CONSTRUCTION",
  "RENOVATION",
  "REPAIR",
  "NOT_SURE",
] as const;
export type ExpertProjectType = (typeof EXPERT_PROJECT_TYPES)[number];

export const EXPERT_PROJECT_LABELS: Record<ExpertProjectType, string> = {
  NEW_CONSTRUCTION: "New construction",
  RENOVATION: "Renovation",
  REPAIR: "Repair",
  NOT_SURE: "Not sure",
};

export const EXPERT_DISCLAIMER =
  "A reply from Sagar Traders is general product guidance, not a structural, engineering or safety certification. Confirm structural requirements with a qualified professional.";

/** Structured question for the shop's staff. A person answers it: there is no automated or AI answer. */
export const expertSubmissionSchema = z.object({
  idempotencyKey: z.uuid("Invalid submission key."),
  name: text("Name", 2, 100),
  mobile: mobileSchema,
  email: optionalEmail,
  topic: z.enum(EXPERT_TOPICS),
  projectType: z.enum(EXPERT_PROJECT_TYPES).default("NOT_SURE"),
  question: text("Question", 10, 800),
  usage: z.string().trim().max(200, "At most 200 characters.").default(""),
  [HONEYPOT_FIELD]: z.string().max(200).optional(),
});
export type ExpertSubmission = z.infer<typeof expertSubmissionSchema>;
