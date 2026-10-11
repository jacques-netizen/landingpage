// The faint music under the questions. One <audio> element, started inside
// the Start tap (browsers only allow sound after a tap), then faded in on the
// question, steps, gate and building scenes and faded out on every film and
// on the result, so it never sits under a film's own sound.
import { music } from "@/lib/content";

let el: HTMLAudioElement | null = null;
let ready = false;
let target = 0;
let timer = 0;

function element(): HTMLAudioElement | null {
  if (typeof document === "undefined" || !music) return null;
  if (!el) {
    el = document.createElement("audio");
    el.src = music.src;
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    el.setAttribute("aria-hidden", "true");
  }
  return el;
}

/** Call inside a tap handler. Starts the track silently so later fades are allowed. */
export function unlockAmbient() {
  const a = element();
  if (!a || ready) return;
  a.volume = 0;
  a.play()
    .then(() => {
      ready = true;
      if (target === 0) a.pause();
      else fadeTo(target);
    })
    .catch(() => {});
}

function fadeTo(v: number) {
  const a = element();
  if (!a) return;
  window.clearInterval(timer);
  if (v > 0 && a.paused) a.play().catch(() => {});
  timer = window.setInterval(() => {
    const d = v - a.volume;
    if (Math.abs(d) < 0.01) {
      a.volume = v;
      if (v === 0) a.pause();
      window.clearInterval(timer);
      return;
    }
    a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(d) * 0.01));
  }, 40);
}

/** Which scenes carry the music. */
const WITH_MUSIC = new Set(["question", "steps", "gate", "building"]);

export function setAmbientScene(scene: string) {
  target = WITH_MUSIC.has(scene) && music ? music.volume : 0;
  if (ready) fadeTo(target);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const a = el;
    if (!a || !ready) return;
    if (document.hidden) a.pause();
    else if (target > 0) a.play().catch(() => {});
  });
}
