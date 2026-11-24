"use client";

import { useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { submitExpertEnquiryAction } from "@/features/enquiries/request-actions";
import {
  EXPERT_PROJECT_LABELS,
  EXPERT_PROJECT_TYPES,
  EXPERT_TOPICS,
  EXPERT_TOPIC_LABELS,
  type ExpertProjectType,
  type ExpertTopic,
} from "@/features/expert/schemas";
import { ContactFields, RequestShell, useRequestForm } from "./request-enquiry-form";

export function ExpertForm() {
  const [contact, setContact] = useState({ name: "", mobile: "", email: "" });
  const [topic, setTopic] = useState<ExpertTopic>("CONCRETE_MASONRY");
  const [projectType, setProjectType] = useState<ExpertProjectType>("NOT_SURE");
  const [question, setQuestion] = useState("");
  const [usage, setUsage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const form = useRequestForm(submitExpertEnquiryAction);

  return (
    <RequestShell
      form={form}
      title="Ask a materials expert"
      submitLabel="Send question"
      onSubmit={(e) => {
        e.preventDefault();
        form.send({ ...contact, topic, projectType, question, usage }, honeypot);
      }}
    >
      <ContactFields
        values={contact}
        set={(k, v) => setContact((c) => ({ ...c, [k]: v }))}
        errors={form.errors}
        honeypot={honeypot}
        setHoneypot={setHoneypot}
      />
      <Field label="Topic" error={form.errors.topic}>
        {(p) => (
          <Select {...p} value={topic} onChange={(e) => setTopic(e.target.value as ExpertTopic)}>
            {EXPERT_TOPICS.map((t) => (
              <option key={t} value={t}>
                {EXPERT_TOPIC_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Project type" error={form.errors.projectType}>
        {(p) => (
          <Select
            {...p}
            value={projectType}
            onChange={(e) => setProjectType(e.target.value as ExpertProjectType)}
          >
            {EXPERT_PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXPERT_PROJECT_LABELS[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label="Your question"
        required
        error={form.errors.question}
        helper="At least 10 characters."
      >
        {(p) => (
          <Textarea
            {...p}
            rows={5}
            maxLength={800}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        )}
      </Field>
      <Field label="Where will it be used? (optional)" error={form.errors.usage}>
        {(p) => (
          <Input {...p} maxLength={200} value={usage} onChange={(e) => setUsage(e.target.value)} />
        )}
      </Field>
    </RequestShell>
  );
}
