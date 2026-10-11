"use client";
import { useEffect, useState } from "react";
import { media } from "@/lib/content";
import { videoSource } from "@/lib/video/source";

type Row = { id: string; src: string; kind: string; status: string; log: string[] };

export function VideoCheck() {
  const [info, setInfo] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [started, setStarted] = useState(false);

  // Device facts are read after mount, in a task, so the server HTML matches.
  useEffect(() => {
    const t = window.setTimeout(() => {
    const v = document.createElement("video");
    const mse = typeof window.MediaSource !== "undefined";
    setInfo([
      `User agent: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth}x${window.innerHeight}, pixel ratio ${window.devicePixelRatio}`,
      `Media source extensions: ${mse ? "yes" : "no"}`,
      `H.264 MP4 (avc1.64001f): ${v.canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"') || "no"}`,
      `H.264 high 4.2 (avc1.64002a): ${v.canPlayType('video/mp4; codecs="avc1.64002a"') || "no"}`,
      `Native HLS: ${v.canPlayType("application/vnd.apple.mpegurl") || "no"}`,
      `MSE H.264: ${mse && MediaSource.isTypeSupported('video/mp4; codecs="avc1.64001f"') ? "yes" : "no"}`,
      `Online: ${navigator.onLine}, connection: ${(navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection?.effectiveType ?? "unknown"}, save data: ${(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData ?? "unknown"}`,
    ]);
    setRows(Object.keys(media).map((id) => { const s = videoSource(id)!; return { id, src: s.src, kind: s.kind, status: "waiting", log: [] }; }));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const update = (id: string, patch: Partial<Row>, line?: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch, log: line ? [...r.log, `${new Date().toLocaleTimeString()} ${line}`].slice(-8) : r.log } : r)));

  const run = async (id: string, el: HTMLVideoElement) => {
    const s = videoSource(id)!;
    el.muted = true;
    el.playsInline = true;
    const log = (line: string) => update(id, {}, line);
    el.addEventListener("error", () => update(id, { status: `error code ${el.error?.code ?? "?"}` }, `error ${el.error?.code} ${el.error?.message ?? ""}`));
    el.addEventListener("playing", () => update(id, { status: "playing" }, `playing at ${el.videoWidth}x${el.videoHeight}`));
    el.addEventListener("waiting", () => log("buffering"));
    el.addEventListener("stalled", () => log("stalled"));
    el.addEventListener("loadedmetadata", () => log(`metadata, duration ${Math.round(el.duration)}s`));
    if (s.kind === "hls" && el.canPlayType("application/vnd.apple.mpegurl") === "") {
      const { default: Hls } = await import("hls.js");
      if (!Hls.isSupported()) {
        log("hls.js not supported, trying MP4 fallback");
        el.src = s.fallback ?? s.src;
      } else {
        const h = new Hls({ capLevelToPlayerSize: true, startLevel: -1 });
        h.on(Hls.Events.MANIFEST_PARSED, (_e, d) => log(`manifest: ${d.levels.length} levels, ${d.levels.map((l) => l.height).join("/")}`));
        h.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => log(`level ${d.level}`));
        h.on(Hls.Events.ERROR, (_e, d) => log(`hls ${d.fatal ? "FATAL " : ""}${d.type}: ${d.details}`));
        h.loadSource(s.src);
        h.attachMedia(el);
      }
    } else {
      el.src = s.src;
    }
    try {
      await el.play();
      log("play() ok");
    } catch (e) {
      update(id, { status: `play() refused: ${String(e).slice(0, 80)}` });
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-10 font-sans text-[14px] text-ink">
      <h1 className="font-serif text-title">Video check</h1>
      <ul className="mt-6 space-y-1 break-all text-muted">{info.map((l) => <li key={l}>{l}</li>)}</ul>
      {!started && (
        <button type="button" onClick={() => setStarted(true)} className="mt-8 h-12 rounded-pill bg-ink px-7 text-[15px] font-medium text-white">
          Start all films
        </button>
      )}
      <div className="mt-8 space-y-8">
        {rows.map((r) => (
          <section key={r.id} className="border-t border-line pt-4">
            <h2 className="font-medium">{r.id} <span className="text-muted">({r.kind})</span></h2>
            <p className="break-all text-muted">{r.src}</p>
            <p className="mt-1 font-medium">{r.status}</p>
            {started && (
              <video
                ref={(el) => { if (el && !el.dataset.started) { el.dataset.started = "1"; void run(r.id, el); } }}
                className="mt-2 h-40 w-full bg-black object-contain"
                controls
                muted
                playsInline
              />
            )}
            <ul className="mt-2 space-y-0.5 text-[12px] text-muted">{r.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </section>
        ))}
      </div>
    </main>
  );
}
