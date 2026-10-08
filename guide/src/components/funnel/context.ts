import { createContext, useContext } from "react";
import type { Path, Step, Variant } from "@/lib/content";
import type { Answers } from "@/lib/flow";
import type { PublicConfig } from "@/lib/server/config";

export type LeadView = {
  guideToken: string;
  ref: string;
  email: string;
  emailMasked: string;
  company: string | null;
  firstName: string;
  path: string;
  qualified: boolean;
  humanPriority: boolean;
  answers: Answers;
  guideSections?: string[];
};

export type GateInput = {
  firstName: string;
  email: string;
  igHandle: string;
  company: string;
  role?: string;
  consent: boolean;
  turnstileToken?: string;
};

export type GateResult = { ok: true } | { ok: false; error: string; field?: string };

export type FunnelCtx = {
  variant: Variant;
  path: Path | undefined;
  answers: Answers;
  firstName: string | null;
  lead: LeadView | null;
  config: PublicConfig;
  steps: Step[];
  stepIndex: number;
  reduced: boolean;
  /** True once the gate request has settled (ok or not). */
  leadSettled: boolean;
  getSessionToken: () => string | null;
  next: () => void;
  back: () => void;
  go: (id: string) => void;
  answer: (questionId: string, value: unknown, opts?: { advance?: boolean }) => void;
  submitGate: (input: GateInput) => Promise<GateResult>;
  updateLead: (patch: Partial<LeadView>) => void;
};

export const Ctx = createContext<FunnelCtx | null>(null);

export function useFunnel(): FunnelCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useFunnel outside Funnel");
  return c;
}
