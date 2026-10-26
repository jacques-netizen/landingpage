// The reference reports' stylesheet, copied unchanged from reports.maisondelites.com/marrz-final (which
// holds every rule of /winnerman-week-1 plus its additions). Owner brief, 2026-10-26: match them exactly.
export const REPORT_CSS = String.raw`
  :root{
    --bg:#15120D; --panel:#1F1911; --panel-2:#261F15; --panel-3:#2E2519;
    --text:#EFE7D5; --mute:#A09379; --dim:#6E6452;
    --gold:#B8944F; --gold-light:#D4B26A; --gold-soft:#EBD69E; --green:#5FB37E;
    --hair:rgba(212,178,106,.22); --hair-soft:rgba(212,178,106,.11);
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{font-family:'EB Garamond',serif;background:var(--bg);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:9990;opacity:0.04;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  ::selection{background:var(--gold);color:var(--bg)}
  img{display:block;max-width:100%}
  button{font:inherit;color:inherit}
  a{color:inherit}

  .label{font-family:'Archivo',sans-serif;font-weight:600;font-size:0.68rem;letter-spacing:0.3em;text-transform:uppercase;color:var(--gold-light)}
  .statement{font-family:'EB Garamond',serif;font-weight:400;font-size:clamp(1.9rem,4.4vw,3.3rem);line-height:1.1;letter-spacing:-0.012em;max-width:28ch}
  .body-lg{font-size:clamp(1.03rem,1.45vw,1.17rem);color:var(--mute);max-width:64ch;line-height:1.72}
  .body-lg b{color:var(--text);font-weight:500}
  .section{padding:clamp(4.2rem,10vh,7rem) clamp(1.3rem,6vw,6.5rem);position:relative}
  .wrap{max-width:1180px;margin:0 auto}
  .snum{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.66rem;letter-spacing:0.3em;color:var(--gold-light);text-transform:uppercase;display:flex;align-items:center;gap:0.8rem;margin-bottom:1.3rem}
  .snum:before{content:"";width:28px;height:1px;background:var(--gold)}
  h3.sub{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--mute);margin:3rem 0 1.2rem}
  .alt{background:var(--panel)}

  .rv{opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.2,.7,.2,1),transform .9s cubic-bezier(.2,.7,.2,1)}
  .rv.in{opacity:1;transform:none}
  .rv.d1{transition-delay:.08s}.rv.d2{transition-delay:.16s}.rv.d3{transition-delay:.24s}
  @keyframes fadeup{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

  #progress{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-soft));z-index:9999;transition:width .1s linear}
  #dots{position:fixed;right:1.2rem;top:50%;transform:translateY(-50%);z-index:9998;display:flex;flex-direction:column;gap:0.72rem}
  #dots a{position:relative;width:8px;height:8px;border-radius:50%;border:1px solid var(--gold);display:block;transition:.3s}
  #dots a.on{background:var(--gold-light);border-color:var(--gold-light);transform:scale(1.3)}
  #dots a span{position:absolute;right:18px;top:50%;transform:translateY(-50%);white-space:nowrap;font-family:'Archivo',sans-serif;font-size:0.6rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--gold-soft);background:var(--panel);border:1px solid var(--hair);padding:0.3rem 0.6rem;opacity:0;pointer-events:none;transition:.25s}
  #dots a:hover span{opacity:1}
  @media(max-width:1080px){#dots{display:none}}

  /* ============ HERO ============ */
  .hero{position:relative;min-height:92svh;display:flex;flex-direction:column;justify-content:space-between;padding:clamp(1.8rem,4vw,3rem) clamp(1.3rem,6vw,6.5rem);overflow:hidden;
    background:radial-gradient(ellipse 70% 60% at 78% 45%,rgba(184,148,79,.16),transparent 70%),var(--bg)}
  .hero-top{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;position:relative;z-index:3}
  .mark{font-family:'EB Garamond',serif;font-size:1.12rem;letter-spacing:0.04em;text-decoration:none}
  .mark b{color:var(--gold-soft);font-weight:500}
  .hero-body{display:grid;grid-template-columns:1.1fr 0.9fr;gap:2rem;align-items:center;position:relative;z-index:2;flex:1;padding:2rem 0}
  .hero-mid .label{display:block;margin-bottom:1.5rem}
  .live{display:inline-flex;align-items:center;gap:0.55rem;font-family:'Archivo',sans-serif;font-weight:700;font-size:0.66rem;letter-spacing:0.16em;text-transform:uppercase;padding:0.5rem 0.85rem;border:1px solid var(--hair);border-radius:999px;margin-bottom:1.4rem;color:var(--text)}
  .live i{width:8px;height:8px;border-radius:50%;background:var(--green);animation:beat 1.8s infinite}
  @keyframes beat{0%{box-shadow:0 0 0 0 rgba(95,179,126,.6)}70%{box-shadow:0 0 0 9px rgba(95,179,126,0)}100%{box-shadow:0 0 0 0 rgba(95,179,126,0)}}
  .hero h1{font-family:'Archivo',sans-serif;font-weight:800;letter-spacing:-0.045em;font-size:clamp(3.2rem,9.4vw,8rem);line-height:0.88;text-transform:uppercase}
  .hero h1 span{display:block;font-size:0.36em;letter-spacing:0.02em;color:var(--gold-soft);margin-top:0.6rem;line-height:1.05}
  .hero-sub{font-size:clamp(1.08rem,1.9vw,1.32rem);color:var(--text);opacity:.86;margin-top:1.8rem;max-width:46ch;line-height:1.5}
  .hero-sub b{color:var(--gold-soft);font-weight:500}
  .hero-bot{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;position:relative;z-index:3}
  .cover-art{position:relative;width:min(100%,420px);aspect-ratio:1;justify-self:center;isolation:isolate}
  .ca-glow{position:absolute;inset:-14%;z-index:-1;background:radial-gradient(circle,rgba(212,178,106,.36),transparent 62%);filter:blur(24px);animation:pulse 6s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
  .cover-art img{width:100%;height:100%;object-fit:cover;border-radius:16px;transform:rotate(-2.5deg);box-shadow:0 50px 90px -30px rgba(0,0,0,.95),0 0 0 1px rgba(212,178,106,.3);animation:fl 10s ease-in-out infinite}
  @keyframes fl{0%,100%{transform:rotate(-2.5deg) translateY(0)}50%{transform:rotate(-1deg) translateY(-12px)}}
  .ring{position:absolute;right:-8%;bottom:-6%;width:44%;aspect-ratio:1;z-index:3;border-radius:50%;background:rgba(21,18,13,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(235,214,158,.28);box-shadow:0 20px 40px -14px rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center}
  .ring svg{position:absolute;inset:8%;width:84%;height:84%;transform:rotate(-90deg)}
  .ring circle{fill:none;stroke-width:7}
  .ring .bgc{stroke:var(--panel-3)}
  .ring .fgc{stroke:var(--gold-soft);stroke-linecap:round;transition:stroke-dashoffset 1.8s cubic-bezier(.2,.7,.2,1)}
  .ring .rt{position:relative;text-align:center;font-family:'Archivo',sans-serif}
  .ring .rt b{display:block;font-weight:800;font-size:clamp(1.3rem,3vw,1.9rem);color:var(--gold-soft);line-height:1}
  .ring .rt span{font-size:0.5rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--mute)}

  /* ============ SUMMARY ============ */
  .big{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--hair-soft);border:1px solid var(--hair-soft);margin-top:2.4rem}
  .bg{background:var(--panel);padding:1.8rem 1.4rem}
  .bg .bv{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(2.4rem,6vw,4rem);color:var(--gold-soft);line-height:0.95;letter-spacing:-0.04em}
  .bg .bl{font-family:'Archivo',sans-serif;font-size:0.64rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute);margin-top:0.7rem}
  .prog{margin-top:1rem;background:linear-gradient(160deg,var(--panel-3),var(--panel) 70%);border:1px solid var(--hair);padding:clamp(1.4rem,3vw,2rem)}
  .prog-top{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap}
  .prog-top .pk{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.64rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-light)}
  .prog-top .pv{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(1.2rem,2.6vw,1.6rem);color:var(--text)}
  .prog-top .pv b{color:var(--gold-soft)}
  .bar{position:relative;height:16px;background:var(--panel-3);margin-top:1rem;overflow:hidden}
  .bar-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-soft));transition:width 1.8s cubic-bezier(.2,.7,.2,1)}
  .ticks{display:flex;justify-content:space-between;margin-top:0.6rem;font-family:'Archivo',sans-serif;font-size:0.58rem;letter-spacing:0.1em;color:var(--dim)}
  .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-top:1rem}
  .fact{background:var(--panel);border:1px solid var(--hair-soft);padding:1.3rem 1.3rem}
  .fact .fk{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-light)}
  .fact .fv{font-family:'Archivo',sans-serif;font-weight:800;font-size:1.35rem;margin-top:0.45rem}
  .fact p{font-size:0.96rem;color:var(--mute);margin-top:0.3rem;line-height:1.5}

  /* ============ RESULTS ============ */
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--hair-soft);border:1px solid var(--hair-soft);margin-top:2.4rem}
  .g{background:var(--bg);padding:1.4rem 1.1rem;transition:background .3s}
  .g:hover{background:var(--panel-2)}
  .g .gv{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(1.5rem,3.2vw,2.2rem);color:var(--gold-soft);line-height:1;letter-spacing:-0.025em}
  .g .gl{font-family:'Archivo',sans-serif;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute);margin-top:0.55rem}
  .pipe{margin-top:1rem;background:var(--bg);border:1px solid var(--hair-soft);padding:1.4rem 1.4rem}
  .pipe .pk{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-light)}
  .stack{display:flex;height:40px;margin-top:1rem;background:var(--panel-3);overflow:hidden}
  .stack div{width:0;display:flex;align-items:center;padding:0 0.8rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.82rem;white-space:nowrap;overflow:hidden;transition:width 1.4s cubic-bezier(.2,.7,.2,1)}
  .stack .a{background:linear-gradient(90deg,var(--gold),var(--gold-soft));color:var(--bg)}
  .stack .c{background:repeating-linear-gradient(45deg,#4a3d27 0 8px,#3a3020 8px 16px);color:var(--text)}
  .note{margin-top:1rem;display:grid;grid-template-columns:30px 1fr;gap:0.9rem;align-items:center;background:var(--panel-2);border:1px solid var(--hair-soft);border-left:3px solid var(--gold);padding:1.1rem 1.4rem;font-size:1rem;color:var(--text)}
  .note svg{width:26px;height:26px;stroke:var(--gold-light);fill:none;stroke-width:1.7}

  /* ============ TOP CLIPS ============ */
  .share{display:grid;grid-template-columns:auto 1fr;gap:1.6rem;align-items:center;margin-top:2.2rem;background:var(--panel);border:1px solid var(--hair-soft);padding:1.4rem 1.6rem}
  .alt .share{background:var(--bg)}
  .donut{width:120px;height:120px;position:relative}
  .donut svg{width:100%;height:100%;transform:rotate(-90deg)}
  .donut circle{fill:none;stroke-width:14}
  .donut .bgc{stroke:var(--panel-3)}
  .donut .fgc{stroke:var(--gold-soft);transition:stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1)}
  .donut b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Archivo',sans-serif;font-weight:800;font-size:1.5rem;color:var(--gold-soft)}
  .share p{font-size:1.06rem;color:var(--text);line-height:1.55}
  .share p b{color:var(--gold-soft);font-weight:500}
  .sortbar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1.6rem}
  .seg{display:inline-flex;border:1px solid var(--hair);padding:4px;gap:4px;background:var(--panel)}
  .alt .seg{background:var(--bg)}
  .seg button{background:none;border:0;cursor:pointer;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.68rem;letter-spacing:0.14em;text-transform:uppercase;padding:0.65rem 1rem;color:var(--mute);transition:.3s}
  .seg button.on{background:var(--gold);color:var(--bg)}
  .clips{margin-top:1rem;display:flex;flex-direction:column;gap:0.6rem}
  .clip{display:grid;grid-template-columns:28px 46px 1fr 1.6fr 92px 82px;gap:1rem;align-items:center;background:var(--bg);border:1px solid var(--hair-soft);padding:0.85rem 1rem;transition:border-color .3s,background .3s}
  .clip:hover{border-color:var(--hair);background:var(--panel-2)}
  .clip.top{border-color:rgba(212,178,106,.45)}
  .clip .rk{font-family:'Archivo',sans-serif;font-weight:800;font-size:0.9rem;color:var(--gold-light);text-align:center}
  .clip .av{width:46px;height:46px;border-radius:50%;overflow:hidden;border:1px solid var(--hair);background:var(--panel-3)}
  .clip .av img{width:100%;height:100%;object-fit:cover}
  .clip .who b{display:block;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.95rem}
  .clip .who small{font-family:'Archivo',sans-serif;font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute)}
  .clip .vb{position:relative}
  .clip .vb .vt{display:flex;justify-content:space-between;font-family:'Archivo',sans-serif;font-size:0.78rem}
  .clip .vb .vt b{font-weight:800;color:var(--text);font-variant-numeric:tabular-nums}
  .clip .vb .vt span{color:var(--mute)}
  .clip .vb .tr{height:6px;background:var(--panel-3);margin-top:0.45rem;overflow:hidden}
  .clip .vb .fl{height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-soft));transition:width 1.2s cubic-bezier(.2,.7,.2,1)}
  .clip .lr{text-align:right;font-family:'Archivo',sans-serif}
  .clip .lr b{display:block;font-weight:800;font-size:1rem;color:var(--gold-soft)}
  .clip .lr small{font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--mute)}
  .clip .go{justify-self:end;font-family:'Archivo',sans-serif;font-weight:700;font-size:0.6rem;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;color:var(--gold-soft);border:1px solid var(--hair);padding:0.5rem 0.7rem;transition:.25s;white-space:nowrap}
  .clip .go:hover{background:var(--gold);color:var(--bg)}

  .wall{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:0.9rem;margin-top:1.6rem}
  .vtile{position:relative;min-width:0}
  .vt-media{position:relative;aspect-ratio:9/16;border-radius:14px;overflow:hidden;background:#0b0906;cursor:pointer;isolation:isolate;box-shadow:0 22px 44px -22px rgba(0,0,0,.85),0 0 0 1px rgba(212,178,106,.2);transition:transform .6s cubic-bezier(.2,.7,.2,1),box-shadow .6s}
  .vtile:hover .vt-media{transform:translateY(-6px);box-shadow:0 34px 64px -24px rgba(0,0,0,.95),0 0 0 1px rgba(212,178,106,.6),0 0 46px -12px rgba(212,178,106,.4)}
  .vt-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.4s cubic-bezier(.2,.7,.2,1)}
  .vtile:hover .vt-media img{transform:scale(1.06)}
  .vt-media:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;transition:opacity .45s;background:linear-gradient(180deg,rgba(0,0,0,.45) 0%,transparent 22%,transparent 50%,rgba(10,8,5,.95) 100%)}
  .vt-views{position:absolute;top:0.6rem;left:0.6rem;z-index:3;padding:0.32rem 0.55rem;border-radius:999px;background:rgba(15,12,8,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(235,214,158,.25);font-family:'Archivo',sans-serif;font-weight:800;font-size:0.66rem;color:var(--gold-soft);transition:opacity .4s}
  .vt-rank{position:absolute;top:0.6rem;right:0.6rem;z-index:3;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.62rem;color:var(--bg);background:var(--gold-light);border-radius:999px;padding:0.28rem 0.5rem;transition:opacity .4s}
  .vt-play{position:absolute;left:50%;top:46%;z-index:3;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(15,12,8,.35);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.4);transition:transform .45s,background .45s,opacity .4s}
  .vt-play:before{content:"";position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(212,178,106,.55);animation:ring 2.6s cubic-bezier(.2,.7,.2,1) infinite}
  .vt-play > span{width:0;height:0;margin-left:5px;border-left:16px solid #fff;border-top:10px solid transparent;border-bottom:10px solid transparent}
  .vtile:hover .vt-play{transform:translate(-50%,-50%) scale(1.1);background:rgba(184,148,79,.9)}
  @keyframes ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.45);opacity:0}}
  .vt-meta{position:absolute;left:0.7rem;right:0.7rem;bottom:0.7rem;z-index:3;transition:opacity .4s}
  .vt-h{font-family:'Archivo',sans-serif;font-weight:800;font-size:0.82rem;color:#fff}
  .vt-s{font-family:'Archivo',sans-serif;font-size:0.54rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(239,231,213,.72);margin-top:0.2rem}
  .vt-media iframe{position:absolute;inset:0;width:100%;height:100%;border:0;z-index:5;opacity:0;transition:opacity .6s}
  .vtile.loading .vt-play > span{border:0;width:22px;height:22px;margin:0;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .vtile.playing iframe{opacity:1}
  .vtile.playing .vt-play,.vtile.playing .vt-meta,.vtile.playing .vt-views,.vtile.playing .vt-rank{opacity:0;pointer-events:none}
  .vtile.playing .vt-media:after{opacity:0}
  .vt-open{display:inline-flex;margin-top:0.6rem;font-family:'Archivo',sans-serif;font-weight:600;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mute);text-decoration:none}
  .vt-open:hover{color:var(--gold-soft)}
  @media(max-width:1020px){.wall{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:700px){.wall{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0.8rem;margin-left:calc(-1 * clamp(1.3rem,6vw,6.5rem));margin-right:calc(-1 * clamp(1.3rem,6vw,6.5rem));padding:0 clamp(1.3rem,6vw,6.5rem) 0.5rem;scrollbar-width:none}.wall::-webkit-scrollbar{display:none}.wall .vtile{flex:0 0 56%;scroll-snap-align:start}}

  /* ============ LEARNED ============ */
  .learn{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2.4rem}
  .ln{position:relative;background:var(--panel);border:1px solid var(--hair-soft);padding:1.6rem 1.5rem;overflow:hidden;transition:.4s}
  .ln:before{content:"";position:absolute;left:0;top:0;height:3px;width:0;background:var(--gold);transition:width .6s cubic-bezier(.2,.7,.2,1)}
  .ln:hover{transform:translateY(-5px);border-color:var(--hair);background:var(--panel-2)}
  .ln:hover:before{width:100%}
  .ln .lv{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(1.8rem,4vw,2.6rem);color:var(--gold-soft);line-height:1;letter-spacing:-0.03em}
  .ln .lvl{font-family:'Archivo',sans-serif;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mute);margin-top:0.4rem}
  .ln h4{font-family:'Archivo',sans-serif;font-weight:800;font-size:1.15rem;margin-top:1.1rem}
  .ln p{font-size:1rem;color:var(--mute);margin-top:0.5rem;line-height:1.58}
  .ln p b{color:var(--text);font-weight:500}

  /* ============ PLAN ============ */
  .plan{display:grid;grid-template-columns:0.85fr 1.15fr;gap:1rem;margin-top:2.4rem}
  .plan>*{min-width:0}
  .steps{display:flex;flex-direction:column;gap:0.5rem;min-width:0}
  .step{width:100%;min-width:0}
  .step .st{min-width:0;overflow-wrap:anywhere}
  .step{display:grid;grid-template-columns:38px 1fr;gap:0.9rem;align-items:center;background:var(--panel);border:1px solid var(--hair-soft);padding:0.85rem 1rem;cursor:pointer;text-align:left;transition:.3s}
  .alt .step{background:var(--bg)}
  .step:hover{border-color:var(--hair)}
  .step .sn{width:38px;height:38px;border-radius:50%;border:2px solid var(--panel-3);display:flex;align-items:center;justify-content:center;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.78rem;color:var(--mute);transition:.3s}
  .step .st{font-family:'Archivo',sans-serif;font-weight:800;font-size:0.95rem;color:var(--mute);transition:.3s}
  .step.on{border-color:var(--gold);background:var(--panel-2)}
  .step.on .sn{background:var(--gold);border-color:var(--gold);color:var(--bg)}
  .step.on .st{color:var(--text)}
  .step.done .sn{border-color:var(--gold);color:var(--gold-soft)}
  .detail{background:linear-gradient(160deg,var(--panel-3),var(--panel) 70%);border:1px solid var(--hair);border-left:3px solid var(--gold);padding:clamp(1.5rem,3vw,2.2rem);min-height:320px}
  .alt .detail{background:linear-gradient(160deg,var(--panel-3),var(--bg) 70%)}
  .detail .anim{animation:fadeup .45s ease}
  .detail .dk{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold-light)}
  .detail h4{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(1.35rem,2.6vw,1.9rem);letter-spacing:-0.02em;margin-top:0.6rem;line-height:1.15}
  .detail p{font-size:1.05rem;color:var(--text);opacity:.88;margin-top:0.9rem;line-height:1.62}
  .targets{list-style:none;margin-top:1rem}
  .targets li{font-size:1rem;color:var(--text);padding:0.55rem 0 0.55rem 1.3rem;position:relative;border-top:1px solid var(--hair-soft);line-height:1.45}
  .targets li:first-child{border-top:0}
  .targets li:before{content:"";position:absolute;left:0;top:1.05rem;width:6px;height:6px;background:var(--gold);transform:rotate(45deg)}
  .split{display:flex;height:34px;margin-top:1.2rem;overflow:hidden;border:1px solid var(--hair-soft)}
  .split div{display:flex;align-items:center;padding:0 0.8rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.72rem;white-space:nowrap}
  .split .s1{width:75%;background:var(--gold);color:var(--bg)}
  .split .s2{width:25%;background:var(--panel-3);color:var(--gold-soft)}
  .tagline{display:inline-flex;margin-top:1rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.82rem;padding:0.5rem 0.8rem;border:1px solid var(--gold);color:var(--gold-soft)}
  .nextrep{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--hair-soft);border:1px solid var(--hair-soft);margin-top:1rem}
  .nr{background:var(--bg);padding:1rem 1rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.92rem}
  .nr span{display:block;font-weight:700;font-size:0.56rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold-light);margin-bottom:0.3rem}
  .signoff{margin-top:3rem;padding-top:1.6rem;border-top:1px solid var(--hair-soft);display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap}
  .signoff .s-mark{font-family:'EB Garamond',serif;font-size:1.3rem}
  .signoff .s-mark b{color:var(--gold-soft);font-weight:500}
  .signoff .s-r{font-family:'Archivo',sans-serif;font-size:0.66rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--mute);text-align:right;line-height:1.9}
  .signoff .s-r a{color:var(--gold-soft);text-decoration:none}

  @media(max-width:1020px){
    .hero-body{grid-template-columns:1fr;gap:1.6rem}
    .cover-art{width:min(76%,380px);margin:1rem auto 0}
    .grid{grid-template-columns:repeat(3,1fr)}
    .plan{grid-template-columns:1fr}
    .clip{grid-template-columns:24px 42px 1fr 1.3fr 74px}
    .clip .go{grid-column:3/-1;justify-self:start}
  }
  @media(max-width:700px){
    .big,.facts,.learn{grid-template-columns:1fr}
    .grid{grid-template-columns:1fr 1fr}
    .share{grid-template-columns:1fr;justify-items:start}
    .clip{grid-template-columns:22px 40px 1fr 64px;row-gap:0.6rem;gap:0.7rem}
    .clip .av{width:40px;height:40px}
    .clip .vb{grid-column:1/-1;order:5}
    .clip .go{grid-column:1/-1;order:6;justify-self:stretch;text-align:center}
    .nextrep{grid-template-columns:1fr 1fr}
    .ring{right:-4%}
  }
  @media(prefers-reduced-motion:reduce){
    .rv{transition:none;opacity:1;transform:none}
    .cover-art img,.ca-glow,.live i{animation:none}
    html{scroll-behavior:auto}
  }
  /* ============ MARRZ additions ============ */
  .cover-art.tall{aspect-ratio:3/4;width:min(100%,400px)}
  .done-tag{display:inline-flex;align-items:center;gap:0.55rem;font-family:'Archivo',sans-serif;font-weight:700;font-size:0.66rem;letter-spacing:0.16em;text-transform:uppercase;padding:0.5rem 0.85rem;border:1px solid var(--gold);border-radius:999px;margin-bottom:1.4rem;color:var(--gold-soft);background:rgba(184,148,79,.12)}
  .done-tag svg{width:14px;height:14px;stroke:var(--gold-soft);fill:none;stroke-width:2.6}
  .ring .rt b{font-size:clamp(1.1rem,2.6vw,1.6rem)}
  .plats{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:2.4rem}
  .plat{background:var(--panel);border:1px solid var(--hair-soft);padding:1.6rem 1.5rem;position:relative;overflow:hidden}
  .alt .plat{background:var(--bg)}
  .plat.ig{border-color:rgba(212,178,106,.4)}
  .plat .ph{display:flex;align-items:center;gap:0.7rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:1.15rem}
  .plat .ph svg{width:22px;height:22px;fill:var(--gold-soft)}
  .plat .pv{font-family:'Archivo',sans-serif;font-weight:800;font-size:clamp(2.2rem,5vw,3.2rem);color:var(--gold-soft);line-height:0.95;letter-spacing:-0.035em;margin-top:1rem}
  .plat .pl{font-family:'Archivo',sans-serif;font-size:0.6rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mute);margin-top:0.5rem}
  .plat .pm{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--hair-soft);border:1px solid var(--hair-soft);margin-top:1.2rem}
  .plat .pm div{background:var(--panel-2);padding:0.9rem 0.8rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:1.15rem;color:var(--text)}
  .plat .pm small{display:block;font-weight:600;font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--mute);margin-top:0.35rem}
  .cmpbars{margin-top:1rem;background:linear-gradient(160deg,var(--panel-3),var(--panel) 70%);border:1px solid var(--hair);padding:clamp(1.4rem,3vw,2rem)}
  .alt .cmpbars{background:linear-gradient(160deg,var(--panel-3),var(--bg) 70%)}
  .cmpbars .ck{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold-light)}
  .cb-row{display:grid;grid-template-columns:120px 1fr;gap:1rem;align-items:center;margin-top:1rem}
  .cb-row .cn{font-family:'Archivo',sans-serif;font-weight:800;font-size:0.9rem}
  .cb-track{position:relative;height:38px;background:var(--panel-3)}
  .cb-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,var(--gold),var(--gold-soft));transition:width 1.4s cubic-bezier(.2,.7,.2,1)}
  .cb-fill.dim{background:#7a6646}
  .cb-val{position:absolute;top:50%;transform:translateY(-50%);right:0.8rem;font-family:'Archivo',sans-serif;font-weight:800;font-size:0.92rem;color:var(--bg)}
  .cb-val.lt{color:var(--text)}
  .vt-plat{position:absolute;bottom:3.1rem;left:0.7rem;z-index:3;font-family:'Archivo',sans-serif;font-weight:700;font-size:0.5rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--gold-soft);transition:opacity .4s}
  .vtile.playing .vt-plat{opacity:0}
  .vt-media iframe.ig{background:#fff}
  .clip .pf{font-family:'Archivo',sans-serif;font-weight:700;font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-light)}
  .grid.four{grid-template-columns:repeat(4,1fr)}
  @media(max-width:700px){.grid.four{grid-template-columns:1fr 1fr}.plats{grid-template-columns:1fr}.cb-row{grid-template-columns:1fr;gap:0.4rem}}
`
