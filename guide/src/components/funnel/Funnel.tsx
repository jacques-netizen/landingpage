"use client";
// The scene state machine. One scene on screen at a time, full height.
// State lives on the server (session, answers, last scene) and the session
// token sits in localStorage and in the URL hash, so a refresh resumes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { type ProgressMode, type Step, type Variant } from "@/lib/content";
import { pathOf, progressShare, resumeStep, stepsFor, type Answers } from "@/lib/flow";
import { postJson, setApiToken, track } from "@/lib/client/api";
import { safeStorage } from "@/lib/client/storage";
import { loadPixel, pixelEvent } from "@/lib/client/pixel";
import { preload } from "@/lib/video/player";
import { videoSource } from "@/lib/video/source";
import type { PublicConfig } from "@/lib/server/config";
import { Ctx, type FunnelCtx, type GateInput, type GateResult, type LeadView } from "./context";
import { ProgressLine } from "./ui";
import { ColdOpen } from "./scenes/ColdOpen";
import { QuestionScene } from "./scenes/Question";

// Server rendered too: it is the first scene of the plain arm.
const FilmScene = dynamic(() => import("./scenes/Film").then((x) => x.FilmScene));
const StepsScene = dynamic(() => import("./scenes/Steps").then((x) => x.StepsScene), { ssr: false });
const GateScene = dynamic(() => import("./scenes/Gate").then((x) => x.GateScene), { ssr: false });
const BuildingScene = dynamic(() => import("./scenes/Building").then((x) => x.BuildingScene), { ssr: false });
const ResultScene = dynamic(() => import("./scenes/Result").then((x) => x.ResultScene), { ssr: false });

const STORE_KEY = "mde_guide_session";

type SessionResponse = {
  token: string;
  variant: Variant;
  progressMode: ProgressMode;
  answers: Answers;
  lastScene: string | null;
  lead: LeadView | null;
};

type LeadResponse = { lead?: LeadView; error?: string; field?: string };

function readHashToken(): string | null {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{16,64})/.exec(window.location.hash);
  return m ? m[1] : null;
}

function writeHashToken(token: string) {
  try {
    const url = new URL(window.location.href);
    url.hash = `t=${token}`;
    window.history.replaceState(window.history.state, "", url.toString());
  } catch {
    /* ignore */
  }
}

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const source: Record<string, string> = {};
  for (const k of ["src", "mc", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"]) {
    const v = q.get(k);
    if (v) source[k] = v.slice(0, 255);
  }
  return { source };
}

export type FunnelInitial = { variant: Variant; progressMode: ProgressMode; firstName: string | null };

export function Funnel({ config, initial }: { config: PublicConfig; initial: FunnelInitial }) {
  const reducedPref = useReducedMotion();
  // The first scene renders on the server straight away; a returning visitor
  // (token in the hash or storage) is hidden by an inline script until resumed.
  const [variant, setVariant] = useState<Variant>(initial.variant);
  const [progressMode, setProgressMode] = useState<ProgressMode>(initial.progressMode);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepId, setStepId] = useState<string>(() => stepsFor(initial.variant, {})[0].id);
  const [lead, setLead] = useState<LeadView | null>(null);
  const [leadSettled, setLeadSettled] = useState(false);
  const firstName = initial.firstName;
  const tokenRef = useRef<string | null>(null);
  const answersRef = useRef(answers);
  const stepIdRef = useRef(stepId);
  // Answers given before the session exists are sent once it does.
  const pending = useRef<[string, unknown][]>([]);

  // Boot: resume or create the session. Never blocks on failure.
  useEffect(() => {
    const params = readParams();
    const token = readHashToken() || safeStorage.get(STORE_KEY);
    let cancelled = false;
    const reveal = () => {
      delete document.documentElement.dataset.resuming;
    };
    (async () => {
      const force = { variant: initial.variant, progress: initial.progressMode };
      const res = await postJson<SessionResponse>("/api/session", { token, source: params.source, force }, 6000);
      if (cancelled) return;
      if (res.ok && res.data) {
        const s = res.data;
        tokenRef.current = s.token;
        setApiToken(s.token);
        safeStorage.set(STORE_KEY, s.token);
        writeHashToken(s.token);
        for (const [questionId, value] of pending.current.splice(0)) void postJson("/api/answer", { token: s.token, questionId, value });
        // A brand new session: the visitor may already be past the cold open. Keep their place.
        if (!token || s.token !== token) {
          reveal();
          return;
        }
        setVariant(s.variant);
        setProgressMode(s.progressMode);
        const a = s.lead ? s.lead.answers : s.answers;
        answersRef.current = a;
        setAnswers(a);
        setLead(s.lead);
        setLeadSettled(Boolean(s.lead));
        if (s.lead) loadPixel(config.metaPixelId);
        const resumeAt = resumeStep(s.variant, a, s.lastScene, Boolean(s.lead));
        stepIdRef.current = resumeAt;
        setStepId(resumeAt);
      }
      // Offline or server down: keep running in memory. The gate retries the server.
      reveal();
    })();
    return () => {
      cancelled = true;
    };
  }, [config.metaPixelId, initial.variant, initial.progressMode]);

  const steps = useMemo(() => stepsFor(variant, answers), [variant, answers]);
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === stepId));
  const step: Step = steps[stepIndex];
  const path = pathOf(answers);
  const reduced = Boolean(reducedPref) || variant === "plain";

  // One scene_view per scene shown. The server keeps it as last_scene.
  useEffect(() => {
    if (!step) return;
    track("scene_view", { scene: step.id, variant, path: path ?? "none" });
    if (step.scene === "gate") track("gate_view", { variant, path: path ?? "none" });
    // Warm up the next film while this scene is on screen, but only once the
    // visitor has settled on it, so it never competes with the first paint.
    const upcoming = steps.slice(stepIndex + 1).find((s) => s.media);
    const warm = upcoming?.media ? window.setTimeout(() => preload(videoSource(upcoming.media!)), 4000) : 0;
    return () => window.clearTimeout(warm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  const go = useCallback((id: string) => {
    stepIdRef.current = id;
    setStepId(id);
  }, []);

  const next = useCallback(() => {
    const s = stepsFor(variant, answersRef.current);
    const i = s.findIndex((x) => x.id === stepIdRef.current);
    if (i >= 0 && i < s.length - 1) go(s[i + 1].id);
  }, [variant, go]);

  const back = useCallback(() => {
    const s = stepsFor(variant, answersRef.current);
    const i = s.findIndex((x) => x.id === stepIdRef.current);
    track("back_pressed", { scene: stepIdRef.current });
    // Back goes to the previous question, skipping films already watched.
    for (let j = i - 1; j >= 0; j--) {
      if (s[j].scene === "question" || s[j].scene === "cold_open") {
        go(s[j].id);
        return;
      }
    }
  }, [variant, go]);

  const answer = useCallback(
    (questionId: string, value: unknown, opts?: { advance?: boolean }) => {
      let nextAnswers: Answers;
      if (questionId === "role" && answersRef.current.role !== value) nextAnswers = { role: value };
      else nextAnswers = { ...answersRef.current, [questionId]: value };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      track("question_answered", {
        question: questionId,
        value: Array.isArray(value) ? value.join(",") : typeof value === "object" && value ? String((value as { band?: string }).band) : String(value),
      });
      if (tokenRef.current) void postJson("/api/answer", { token: tokenRef.current, questionId, value });
      else pending.current.push([questionId, value]);
      if (opts?.advance !== false) {
        const s = stepsFor(variant, nextAnswers);
        const i = s.findIndex((x) => x.id === stepIdRef.current);
        if (i >= 0 && i < s.length - 1) go(s[i + 1].id);
      }
    },
    [variant, go],
  );

  const submitGate = useCallback(
    async (input: GateInput): Promise<GateResult> => {
      setLeadSettled(false);
      // Plain variant picks the role at the gate.
      let a = answersRef.current;
      if (input.role && a.role !== input.role) {
        a = { role: input.role };
        answersRef.current = a;
        setAnswers(a);
      }
      if (!tokenRef.current) {
        const res = await postJson<SessionResponse>("/api/session", { source: readParams().source }, 6000);
        if (!res.ok || !res.data) return { ok: false, error: "network" };
        tokenRef.current = res.data.token;
        setApiToken(res.data.token);
        safeStorage.set(STORE_KEY, res.data.token);
        writeHashToken(res.data.token);
      }
      const res = await postJson<LeadResponse>(
        "/api/lead",
        { token: tokenRef.current, answers: a, ...input, fbp: readCookie("_fbp"), fbc: readCookie("_fbc") },
        20_000,
      );
      if (res.ok && res.data?.lead) {
        setLead(res.data.lead);
        setLeadSettled(true);
        // Consent was just given at the gate: the pixel may load now.
        loadPixel(config.metaPixelId);
        pixelEvent("Lead", res.data.lead.metaEventId, { content_category: res.data.lead.path });
        return { ok: true };
      }
      setLeadSettled(true);
      if (res.status === 429) return { ok: false, error: "rateLimited" };
      return { ok: false, error: res.data?.error || "network", field: res.data?.field };
    },
    [config.metaPixelId],
  );

  const updateLead = useCallback((patch: Partial<LeadView>) => setLead((l) => (l ? { ...l, ...patch } : l)), []);

  const ctx: FunnelCtx = {
    variant,
    path,
    answers,
    firstName,
    lead,
    config,
    steps,
    stepIndex,
    reduced,
    leadSettled,
    getSessionToken: () => tokenRef.current,
    next,
    back,
    go,
    answer,
    submitGate,
    updateLead,
  };

  const dark = step ? step.scene === "film" || step.scene === "cold_open" || step.scene === "steps" || step.scene === "building" : false;
  const showProgress = step && step.scene !== "cold_open" && step.scene !== "result" && step.scene !== "building";

  return (
    <Ctx.Provider value={ctx}>
      <LazyMotion features={domAnimation} strict>
        <div className={`funnel-stage relative h-dvh w-full overflow-hidden ${dark ? "bg-ink-black" : "bg-paper"}`}>
          {showProgress && <ProgressLine share={progressShare(variant, answers, step.id)} mode={progressMode} dark={dark} />}
          <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={step.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: reduced ? (variant === "plain" ? 0 : 0.2) : 0.42, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, transition: { duration: reduced ? (variant === "plain" ? 0 : 0.15) : 0.26, ease: [0.64, 0, 0.78, 0] } }}
              >
                <SceneFor step={step} />
              </m.div>
          </AnimatePresence>
        </div>
      </LazyMotion>
    </Ctx.Provider>
  );
}

function SceneFor({ step }: { step: Step }) {
  switch (step.scene) {
    case "cold_open":
      return <ColdOpen step={step} />;
    case "question":
      return <QuestionScene step={step} />;
    case "film":
      return <FilmScene step={step} />;
    case "steps":
      return <StepsScene step={step} />;
    case "gate":
      return <GateScene step={step} />;
    case "building":
      return <BuildingScene />;
    case "result":
      return <ResultScene />;
  }
}

function readCookie(name: string): string | undefined {
  try {
    const m = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}
