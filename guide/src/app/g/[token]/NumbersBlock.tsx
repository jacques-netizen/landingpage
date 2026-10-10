"use client";
// The numbers model as the proposal's calculator: a slider the reader can
// move, with the outputs recomputed in the browser from the same functions
// the writer used. Buyers move the monthly budget; clippers move clips a week.
import { useState } from "react";
import { buyerNumbersFrom, clipperNumbersFrom, CPM, money, short, type Numbers } from "@/lib/guide/model";

const two = (n: number) => n.toLocaleString("en-US");

export function NumbersBlock({ numbers, labels }: { numbers: Numbers; labels: Record<string, string> }) {
  if (numbers.kind === "buyer") return <Buyer base={numbers} labels={labels} />;
  return <Clipper base={numbers} labels={labels} />;
}

function Buyer({ base, labels }: { base: Extract<Numbers, { kind: "buyer" }>; labels: Record<string, string> }) {
  const min = 1000;
  const max = 60000;
  const [budget, setBudget] = useState(Math.min(max, Math.max(min, base.monthlyBudget)));
  const n = buyerNumbersFrom(budget, true, base.currentPost);
  const pct = ((budget - min) / (max - min)) * 100;
  const peak = n.months[2].total;
  return (
    <div className="model">
      <div className="ctrl">
        <div className="ctrl-head">
          <span className="cl">{labels.budgetSlider}</span>
          <span className="cv">{money(budget)}</span>
        </div>
        <input type="range" min={min} max={max} step={500} value={budget} aria-label={labels.budgetSlider} style={{ "--p": `${pct}%` } as React.CSSProperties} onChange={(e) => setBudget(Number(e.target.value))} />
        <div className="range-ends"><span>{money(min)}</span><span>{money(max)}</span></div>
      </div>
      <div className="out">
        <div className="o big"><div className="ov">{short(n.views.mid)}</div><div className="ol">{labels.viewsMid} ${CPM.mid.toFixed(2)}</div></div>
        <div className="o"><div className="ov">{short(n.views.low)}</div><div className="ol">{labels.viewsLow} ${CPM.low.toFixed(2)}</div></div>
        <div className="o"><div className="ov">{short(n.views.high)}</div><div className="ol">{labels.viewsHigh} ${CPM.high.toFixed(2)}</div></div>
      </div>
      <div className="out" style={{ marginTop: 1 }}>
        <div className="o"><div className="ov">{two(n.perDay.mid)}</div><div className="ol">{labels.perDay}</div></div>
        <div className="o"><div className="ov">{n.timesCurrentPost ? `${n.timesCurrentPost}x` : short(n.views.mid)}</div><div className="ol">{n.timesCurrentPost ? labels.timesPost : labels.viewsMonth}</div></div>
        <div className="o"><div className="ov">{short(peak)}</div><div className="ol">{labels.monthThree}</div></div>
      </div>
      <div className="months" aria-label={labels.monthsLabel}>
        {n.months.map((m) => (
          <div className="month" key={m.month}>
            <div className="mk">{labels.month} {m.month}</div>
            <div className="mv">{short(m.total)}</div>
            <div className="mb"><span style={{ width: `${(m.total / peak) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <p className="model-note">{labels.buyerNote}</p>
    </div>
  );
}

function Clipper({ base, labels }: { base: Extract<Numbers, { kind: "clipper" }>; labels: Record<string, string> }) {
  const min = 3;
  const max = 60;
  const [clips, setClips] = useState(Math.min(max, Math.max(min, base.clipsPerWeek)));
  const n = clipperNumbersFrom(clips);
  const pct = ((clips - min) / (max - min)) * 100;
  return (
    <div className="model">
      <div className="ctrl">
        <div className="ctrl-head">
          <span className="cl">{labels.clipsSlider}</span>
          <span className="cv">{clips}</span>
        </div>
        <input type="range" min={min} max={max} step={1} value={clips} aria-label={labels.clipsSlider} style={{ "--p": `${pct}%` } as React.CSSProperties} onChange={(e) => setClips(Number(e.target.value))} />
        <div className="range-ends"><span>{min}</span><span>{max}</span></div>
      </div>
      <div className="out">
        {n.perClip.map((c) => (
          <div className="o" key={c.views}><div className="ov">{money(c.pay)}</div><div className="ol">{labels.perClip} {short(c.views)} {labels.views}</div></div>
        ))}
      </div>
      <div className="out" style={{ marginTop: 1 }}>
        {n.monthly.map((m) => (
          <div className="o" key={m.avgViews}><div className="ov">{money(m.pay)}</div><div className="ol">{labels.monthIf} {short(m.avgViews)} {labels.views}</div></div>
        ))}
      </div>
      <p className="model-note">{labels.clipperNote}</p>
    </div>
  );
}
