// The reference reports' script (reports.maisondelites.com/winnerman-week-1 and /marrz-final), with the
// numbers they had typed in read from window.__R instead. In the PDF every figure, ring and bar is set to
// its final value at once.
export const REPORT_SCRIPT = String.raw`(function(){
  const R=window.__R;
  const reduce=R.print||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const once=(els,fn,th=0.3)=>{
    els=[...els].filter(Boolean);
    if(R.print){els.forEach(fn);return;}
    const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){fn(e.target);io.unobserve(e.target);}}),{threshold:th});
    els.forEach(el=>io.observe(el));
  };
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  once(document.querySelectorAll('.rv'),el=>el.classList.add('in'),0.08);

  const prog=document.getElementById('progress');
  addEventListener('scroll',()=>{const h=document.documentElement;prog.style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100)+'%';},{passive:true});
  const dots=[...document.querySelectorAll('#dots a')];
  const secs=dots.map(a=>document.querySelector(a.getAttribute('href')));
  if(!R.print){const sio=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const i=secs.indexOf(e.target);dots.forEach((d,j)=>d.classList.toggle('on',j===i));}}),{rootMargin:'-45% 0px -45% 0px'});
  secs.forEach(s=>s&&sio.observe(s));}

  const fmt=(n,el)=>el.dataset.dec?n.toFixed(+el.dataset.dec):Math.round(n).toLocaleString('en-US');
  once(document.querySelectorAll('.cu'),el=>{
    const t=parseFloat(el.dataset.target);
    if(reduce){el.textContent=fmt(t,el);return;}
    const dur=1300,s=performance.now();
    (function f(now){const p=Math.min((now-s)/dur,1),e=1-Math.pow(1-p,3);el.textContent=fmt(t*e,el);if(p<1)requestAnimationFrame(f);})(s);
  },0.5);

  /* rings and bars */
  const ringTo=(el,pct,len)=>{if(!el)return;el.querySelector('.fgc').style.strokeDashoffset=(len*(1-pct)).toFixed(1);};
  if(R.hero!==null){if(R.print)ringTo(document.getElementById('heroRing'),R.hero,276.5);else setTimeout(()=>ringTo(document.getElementById('heroRing'),R.hero,276.5),700);}
  once([document.getElementById('prog')],el=>el.querySelectorAll('.bar-fill').forEach(b=>b.style.width=b.dataset.w+'%'),0.4);
  once([document.getElementById('pipe')],el=>el.querySelectorAll('.stack div').forEach(b=>b.style.width=b.dataset.w+'%'),0.4);
  once([document.getElementById('cmpbars')],el=>el.querySelectorAll('.cb-fill').forEach(b=>b.style.width=b.dataset.w+'%'),0.4);
  if(R.share!==null) once([document.getElementById('share')],el=>ringTo(el,R.share,251.3),0.4);

  /* top clips */
  const CL=R.CL;
  const clips=document.getElementById('clips');
  const wall=document.getElementById('wall');
  if(clips&&wall&&CL.length){
  const short=n=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'M':n>=1000?(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,'')+'K':String(n);
  const pic=(c,alt)=>c.img?'<img src="'+esc(c.img)+'" alt="'+esc(alt)+'"'+(R.print?'':' loading="lazy"')+'>':'';
  const maxV=Math.max(...CL.map(c=>c.v));
  let shown=false;
  function who(c){
    if(R.multi) return '<span class="pf">'+c.pf+'</span>'+(c.d?' &middot; '+c.d:'')+(c.s!=null?' &middot; '+c.s.toLocaleString('en-US')+' shares':'');
    return [c.f?c.f+' followers':'',c.d].filter(Boolean).join(' &middot; ');
  }
  function draw(mode){
    const rows=CL.map((c,i)=>({...c,i,r:c.v?c.l/c.v:0})).sort((a,b)=>mode==='rate'?b.r-a.r:mode==='shares'?(b.s||0)-(a.s||0):b.v-a.v);
    clips.innerHTML=rows.map((c,k)=>'<div class="clip'+(c.i<R.top?' top':'')+'">'+
      '<div class="rk">'+(k+1)+'</div>'+
      '<div class="av">'+(c.img?pic(c,''):'<span>'+esc(c.p.charAt(0))+'</span>')+'</div>'+
      '<div class="who"><b>@'+esc(c.p)+'</b><small>'+who(c)+'</small></div>'+
      '<div class="vb"><div class="vt"><b>'+c.v.toLocaleString('en-US')+' views</b><span>'+c.l.toLocaleString('en-US')+' likes</span></div><div class="tr"><div class="fl" data-w="'+(c.v/maxV*100).toFixed(1)+'"></div></div></div>'+
      '<div class="lr"><b>'+(c.r*100).toFixed(1)+'%</b><small>Like rate</small></div>'+
      '<a class="go" href="'+esc(c.url)+'" target="_blank" rel="noopener">Watch &#8599;</a></div>').join('');
    if(shown) requestAnimationFrame(()=>clips.querySelectorAll('.fl').forEach(f=>f.style.width=f.dataset.w+'%'));
  }
  draw('views');

  /* clip wall: tap to play in place */
  wall.innerHTML=CL.map((c,i)=>'<div class="vtile rv'+(i%3?' d'+(i%3):'')+'" data-id="'+esc(c.id)+'" data-pf="'+c.pf+'">'+
    '<div class="vt-media" role="button" tabindex="0" aria-label="Play clip from @'+esc(c.p)+'">'+
    (c.img?pic(c,'Clip from @'+c.p):'<span class="vt-none">'+esc(c.p.charAt(0))+'</span>')+
    '<span class="vt-views">'+short(c.v)+' views</span><span class="vt-rank">#'+(i+1)+'</span>'+
    '<span class="vt-play" aria-hidden="true"><span></span></span>'+
    (R.multi?'<span class="vt-plat">'+c.pf+'</span>':'')+
    '<div class="vt-meta"><div class="vt-h">@'+esc(c.p)+'</div><div class="vt-s">'+(c.d?c.d+' &middot; ':'')+(R.multi?short(c.l):c.l.toLocaleString('en-US'))+' likes</div></div></div>'+
    '<a class="vt-open" href="'+esc(c.url)+'" target="_blank" rel="noopener">Open on '+c.pf+' &#8599;</a></div>').join('');
  once(wall.querySelectorAll('.rv'),el=>el.classList.add('in'),0.08);
  const TT='?autoplay=1&controls=1&progress_bar=1&play_button=1&volume_control=1&fullscreen_button=1&timestamp=1&loop=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0';
  function playTile(t){
    if(t.classList.contains('playing')||t.classList.contains('loading')) return;
    t.classList.add('loading');
    const f=document.createElement('iframe');
    if(t.dataset.pf==='Instagram'){f.src='https://www.instagram.com/p/'+t.dataset.id+'/embed/';f.className='ig';f.setAttribute('scrolling','no');f.title='Instagram clip';}
    else if(t.dataset.pf==='TikTok'){f.src='https://www.tiktok.com/player/v1/'+t.dataset.id+TT;f.title='TikTok clip';}
    else{t.classList.remove('loading');const a=t.querySelector('.vt-open');if(a)window.open(a.href,'_blank','noopener');return;}
    f.allow='autoplay; encrypted-media; fullscreen; picture-in-picture'; f.setAttribute('allowfullscreen','');
    f.addEventListener('load',()=>{t.classList.remove('loading');t.classList.add('playing');});
    t.querySelector('.vt-media').appendChild(f);
    setTimeout(()=>{t.classList.remove('loading');t.classList.add('playing');},4000);
  }
  wall.querySelectorAll('.vtile').forEach(t=>{const m=t.querySelector('.vt-media');m.addEventListener('click',()=>playTile(t));m.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();playTile(t);}});});
  window.addEventListener('message',e=>{
    if(typeof e.data!=='object'||!e.data||!e.data['x-tiktok-player']||e.data.type!=='onPlayerReady') return;
    try{e.source.postMessage({'x-tiktok-player':true,type:'play'},'*');e.source.postMessage({'x-tiktok-player':true,type:'unMute'},'*');}catch(err){}
  });
  once([clips],()=>{shown=true;clips.querySelectorAll('.fl').forEach(f=>f.style.width=f.dataset.w+'%');},0.3);
  const sb=[...document.querySelectorAll('#sortSeg button')];
  sb.forEach(b=>b.addEventListener('click',()=>{sb.forEach(x=>x.classList.toggle('on',x===b));draw(b.dataset.m);}));
  }

  /* plan stepper */
  const P=R.P;
  const stepsEl=document.getElementById('steps'), detail=document.getElementById('detail');
  if(stepsEl&&detail&&P.length){
  stepsEl.innerHTML=P.map((p,i)=>'<button class="step"><span class="sn">'+(i+1)+'</span><span class="st">'+esc(p.title)+'</span></button>').join('');
  function setP(i){
    const p=P[i];
    const b=p.split?Math.max(5,Math.min(95,p.split.bPct)):25;
    [...stepsEl.children].forEach((b,j)=>{b.classList.toggle('on',j===i);b.classList.toggle('done',j<i);});
    detail.style.animation='none';void detail.offsetWidth;detail.style.animation='';
    detail.innerHTML='<div class="dk">Step '+(i+1)+' of '+P.length+'</div><h4>'+esc(p.title)+'</h4><p>'+esc(p.body)+'</p>'+
      (p.list&&p.list.length?'<ul class="targets">'+p.list.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'')+
      (p.split?'<div class="split"><div class="s1" style="width:'+(100-b)+'%">'+esc(p.split.a)+'</div><div class="s2" style="width:'+b+'%">'+esc(p.split.b)+'</div></div>':'')+
      (p.tag?'<span class="tagline">'+esc(p.tag)+'</span>':'');
  }
  [...stepsEl.children].forEach((b,i)=>b.addEventListener('click',()=>setP(i)));
  setP(0);
  }
})();`
