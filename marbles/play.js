// The last screen as a game: let a marble go and it rolls down a small porcelain marble run into the jar. It cannot miss.
// Around that: five problems to browse, a card per idea, your own marbles, and sending the jar.
// There is no score on purpose: a score would reward filling the jar instead of choosing.
const Play=(()=>{
  const {Events}=Matter;
  const FRAME=1000/60, STEP=1000/240;                 // Matter measures speed per 60 Hz frame; we simulate 4 small steps per frame
  const GRAVITY=1.3, TOP_SPEED=9.5;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const cap=(v,max)=>{const s=Math.hypot(v.x,v.y);return s>max?{x:v.x*max/s,y:v.y*max/s}:v};
  const byId=id=>ideas.find(i=>i.id===id);
  const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,k)=>values[k]);

  let stage=null,art=null,engine=null,statics=[],mouth=null,W=0,H=0,frame=0,last=0,acc=0,hintTimer=0,seenAreas=new Set(),told=new Set();
  const loose=new Map();                              // idea id → marble that is in the air

  // ---------- sound: short glass and porcelain tones made on the fly, no audio files ----------
  const Sound=(()=>{
    // Switched off for now: no tones, no toggle in the header. Set `on=true` to bring the sound back.
    let audio=null,on=false,lastTime=0;
    function wake(){if(!on)return;try{audio??=new AudioContext();if(audio.state==='suspended')audio.resume()}catch{}}
    function tone(partials,level){
      if(!on||!audio||audio.state!=='running')return;
      const t=audio.currentTime;if(t-lastTime<.022)return;lastTime=t;
      partials.forEach(([hz,length],k)=>{
        const o=audio.createOscillator(),g=audio.createGain();
        o.frequency.value=hz;g.gain.setValueAtTime(level/(k+1),t);g.gain.exponentialRampToValueAtTime(.0001,t+length);
        o.connect(g).connect(audio.destination);o.start(t);o.stop(t+length);
      });
    }
    const wobble=()=>.97+Math.random()*.06;
    return {
      wake,
      get on(){return on},
      toggle(){on=!on;try{sessionStorage.setItem('idea-map-sound',on?'on':'off')}catch{}wake();return on},
      clink(power,pitch=1){if(power>.7)tone([[2350*pitch*wobble(),.16],[3870*pitch*wobble(),.09],[5900*pitch,.05]],Math.min(.09,power*.007))},
      land(){tone([[1568,.3],[2093,.24],[3136,.12]],.07)}
    };
  })();
  Events.on(jarEngine,'collisionStart',e=>{
    if(jarSettling||!stage)return;
    for(const p of e.pairs)Sound.clink(Math.hypot(p.bodyA.velocity.x-p.bodyB.velocity.x,p.bodyA.velocity.y-p.bodyB.velocity.y)*2,.82);
  });
  const buzz=ms=>{try{navigator.vibrate?.(ms)}catch{}};

  // ---------- what the jar says about its owner ----------
  function reading(){
    const picked=[...state.picked].map(byId),own=picked.filter(i=>i.own).length;
    const counts=groups.map((g,k)=>({k,title:g.title,tint:g.tint,n:picked.filter(i=>i.g===k).length})).filter(c=>c.n);
    if(!counts.length)return {text:'',counts};
    const ranked=[...counts].sort((a,b)=>b.n-a.n);
    let text;
    if(ranked.length===1||ranked[0].n>ranked[1].n)text=fill(U.readingOne,{a:ranked[0].title});
    else if(ranked.length===2||ranked[1].n>ranked[2].n)text=fill(U.readingTwo,{a:ranked[0].title,b:ranked[1].title});
    else text=fill(U.readingMany,{n:ranked.length});
    if(own)text+=' '+fill(U.readingOwn,{n:own});
    return {text,counts};
  }
  const signature=()=>[...state.picked].sort().join('|');
  function jarText(note=''){
    const picked=[...state.picked].map(byId);
    return U.message+'\n\n'+picked.map(i=>'• '+i.title+(i.own?' ('+U.ownTag.toLowerCase()+(i.note?': '+i.note:'')+')':'')).join('\n')+(note?'\n\n'+note:'')+'\n\n'+state.fullName;
  }

  // ---------- the screen ----------
  // The shelves hold the ideas and, as the last marble, a grey one that opens "Add your own". Never more than two shelves,
  // marbles spread evenly (7 → 4+3, 5 → 3+2, 4 → 2+2), so no shelf is left with a single marble.
  function shelfRows(list){
    const items=[...list.map(i=>'<button class="pick" data-id="'+esc(i.id)+'">'+ball(i)+'<span class="pick-name">'+esc(i.title)+'</span></button>'),
      '<button class="pick add-own"><span class="ball own" aria-hidden="true"></span><span class="pick-name">'+esc(U.ownAdd)+'</span></button>'];
    // Always two shelves, so the block is the same height for every problem (nothing below it moves when you switch).
    // Both rows use the top row's column width; a shorter second row is centred under it.
    const shelves=items.length>=2?2:1,base=Math.floor(items.length/shelves),extra=items.length%shelves,cols=base+(extra?1:0);
    let html='',at=0;
    for(let k=0;k<shelves;k++){const n=base+(k<extra?1:0);html+='<div class="rail" style="--slots:'+n+';--cols:'+cols+'">'+items.slice(at,at+n).join('')+'</div>';at+=n}
    return html;
  }
  // How a first-time visitor learns that a marble opens its idea (owner is testing both): ?tap=line, ?tap=ring, default both.
  // Both disappear once the first idea has been read.
  const tapParam=new URLSearchParams(location.search).get('tap')||'both',tapCue={line:tapParam!=='ring',ring:tapParam!=='line'};
  function renderArea(){
    const g=groups[state.area],list=ideas.filter(i=>i.g===state.area&&!i.own);
    stage.querySelector('.play-head h1').textContent=g.title;
    // The dots sit at the top of the shelves block, between the title and the top shelf.
    stage.querySelector('.play-shelves').innerHTML=
      '<nav class="problem-dots">'+groups.map((p,k)=>'<button class="dot" data-area="'+k+'" style="--tint:'+p.tint+'"></button>').join('')+'</nav>'+shelfRows(list)+(tapCue.line&&!state.read.size?'<p class="tap-hint">'+esc(U.tapHint)+'</p>':'');
    for(const dot of stage.querySelectorAll('.problem-dots .dot'))dot.onclick=()=>setArea(+dot.dataset.area);
    stage.style.setProperty('--tint',g.tint);
    for(const b of stage.querySelectorAll('.pick:not(.add-own)'))bindPick(b);
    if(tapCue.ring&&!state.read.size)stage.querySelector('.pick:not(.add-own)')?.classList.add('tap-cue');
    stage.querySelector('.add-own').onclick=()=>{Sound.wake();openOwn()};
    seenAreas.add(state.area);
    // The shelves go on to both sides: a marble of the neighbouring problem looks in from each edge of the screen.
    // Until the visitor has moved once, the one on the right keeps rolling in a little (play.css, "fresh").
    for(const peek of stage.querySelectorAll('.area-peek'))peek.innerHTML=ball({g:(state.area+ +peek.dataset.step+groups.length)%groups.length,shade:0});
    stage.classList.toggle('fresh',seenAreas.size<2);
  }
  function refresh(){
    const count=state.picked.size;
    // A named visitor's jar carries their name on a paper label (it moves with the jar); the line under it then shows
    // only the count. Guests keep "Your jar" under the jar. The button says both to screen readers.
    const tag=stage.querySelector('.jar-tag');tag.innerHTML=state.name?'<b>'+esc(named(U.jarTagName))+'</b><small>'+esc(U.jarTagWord)+'</small>':'';tag.hidden=!state.name;
    // A long name shrinks to fit the label (down to 70%) before it is cut with "…".
    const fit=tag.querySelector('b');if(fit){let k=1;tag.style.setProperty('--fit',1);while(fit.scrollWidth>fit.clientWidth+1&&k>.7){k-=.05;tag.style.setProperty('--fit',k.toFixed(2))}}
    stage.querySelector('.jar-name').textContent=jarTitle();stage.querySelector('.jar-name').hidden=!!state.name;
    stage.querySelector('.jar-count').textContent=count;
    stage.querySelector('.play-jar').setAttribute('aria-label',jarTitle()+', '+count);
    for(const b of stage.querySelectorAll('.pick')){
      b.classList.toggle('selected',state.picked.has(b.dataset.id));
      b.classList.toggle('away',loose.has(b.dataset.id));
      b.classList.toggle('read',state.read.has(b.dataset.id));
    }
    groups.forEach((g,k)=>{
      const list=ideas.filter(i=>i.g===k&&!i.own),read=list.filter(i=>state.read.has(i.id)).length,dot=stage.querySelector('[data-area="'+k+'"]');
      dot.style.setProperty('--done',read/list.length);
      dot.classList.toggle('current',k===state.area);
      dot.setAttribute('aria-label',g.title+'. '+fill(U.areaRead,{read,total:list.length}));
      dot.setAttribute('aria-current',k===state.area);
    });
    const send=stage.querySelector('.send-jar'),sealed=count>0&&state.sent===signature();
    send.hidden=!count;send.textContent=sealed?U.sent+' ✓':U.send;send.classList.toggle('sealed',sealed);
    stage.querySelector('.play-jar').classList.toggle('sealed',sealed);
    stage.querySelector('.play-jar').classList.toggle('filled',count>0);
  }
  // No written hints on the page (visual cues only). The few moments that still deserve words are said to screen readers.
  function hint(text){const p=stage.querySelector('.play-live');if(p)p.textContent=text}
  function areaKeys(e){
    if(!stage||sheet.open||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,textarea,select'))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setArea(state.area+(e.key==='ArrowRight'?1:-1))}
  }
  // Say something once, the first time it becomes relevant.
  function tell(key,text){if(told.has(key))return;told.add(key);hint(text,7000)}
  function setArea(k){
    k=(k+groups.length)%groups.length;                 // the arrows wrap around
    if(k===state.area)return;
    const forward=(k-state.area+groups.length)%groups.length<=groups.length/2?1:-1;
    state.area=k;save();renderArea();layout();refresh();
    if(!reduced.matches){
      stage.querySelector('.play-head h1').animate([{opacity:0,transform:'translateX('+forward*18+'px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
      for(const [n,b] of [...stage.querySelectorAll('.pick')].entries())
        b.animate([{opacity:0,transform:'translateX('+forward*26+'px)'},{opacity:1,transform:'none'}],{duration:420,delay:n*40,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
    }
    if(seenAreas.size===groups.length)tell('all',U.hintAllAreas);
  }

  // ---------- the physical world: walls, ramp, funnel and the jar, all in the stage's own pixels ----------
  // All five titles share one size: the largest at which the longest one still fits on one line. So the title never
  // wraps for one problem and not another, and nothing under it moves when you switch.
  function fitTitle(){
    const h=stage.querySelector('.play-head h1');h.style.fontSize='';h.style.whiteSpace='';
    const cs=getComputedStyle(h),base=parseFloat(cs.fontSize),ls=parseFloat(cs.letterSpacing)||0,avail=h.clientWidth;
    const c=fitTitle.ctx||(fitTitle.ctx=document.createElement('canvas').getContext('2d'));
    c.font=cs.fontStyle+' '+cs.fontWeight+' '+base+'px '+cs.fontFamily;
    const widest=Math.max(...groups.map(g=>c.measureText(g.title).width+ls*g.title.length));
    const size=Math.max(19,Math.min(base,base*avail/widest*.97));
    h.style.fontSize=size+'px';if(widest*size/base<=avail)h.style.whiteSpace='nowrap';
  }
  function layout(){
    fitTitle();
    const S=stage.getBoundingClientRect();W=S.width;H=S.height;
    const jr=stage.querySelector('.bottle').getBoundingClientRect(),s=jr.width/150,left=jr.left-S.left,top=jr.top-S.top;
    const at=(x,y)=>({x:left+x*s,y:top+y*s});
    mouth={x:at(75,0).x,y:at(0,14).y,left:at(38,0).x,right:at(112,0).x,s,box:{left,top,right:left+jr.width,bottom:top+jr.height}};
    Composite.remove(engine.world,statics);statics=[];
    const still={isStatic:true,restitution:.3,friction:.05};
    const add=(body,label,extra)=>{body.label=label;Object.assign(body.plugin,extra);statics.push(body);return body};
    const bar=(a,b,thick,options)=>Bodies.rectangle((a.x+b.x)/2,(a.y+b.y)/2,Math.hypot(b.x-a.x,b.y-a.y)+2,thick,{...still,...options,angle:Math.atan2(b.y-a.y,b.x-a.x)});
    add(Bodies.rectangle(-100,H/2,200,H*6,still),'wall');
    add(Bodies.rectangle(W+100,H/2,200,H*6,still),'wall');
    let svg='';
    {
      // Two porcelain rails funnel everything into the jar: this is what makes the drop impossible to miss.
      const drop=Math.min(84,mouth.left*.5),rails=[[{x:-4,y:mouth.y-drop},{x:mouth.left-1,y:mouth.y-1}],[{x:W+4,y:mouth.y-drop},{x:mouth.right+1,y:mouth.y-1}]];
      for(const [a,b] of rails){add(bar(a,b,7,{restitution:.3}),'rail');svg+='<line class="rail-line" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>'}
      layout.railY=x=>x<mouth.left?mouth.y-drop+drop*clamp(x/mouth.left,0,1):x>mouth.right?mouth.y-drop+drop*clamp((W-x)/(W-mouth.right),0,1):mouth.y;
      layout.funnelTop=mouth.y-drop-30;
      // Above the funnel, one sloped ramp turns the screen into a small marble run: the marble rolls one way, drops, rolls back.
      // It reaches a little past the middle (so it drops onto the far funnel rail) and sits halfway between the shelves and
      // the funnel, with equal room above and below. It is left out when there is no room (small phones, full shelves).
      const shelves=stage.querySelector('.play-shelves').getBoundingClientRect(),reach=W*.6,rise=reach*.33,
        room=(mouth.y-drop)-(shelves.bottom-S.top),first=shelves.bottom-S.top+Math.max(34,(room-rise)/2);
      stage.style.setProperty('--peek-y',(stage.querySelector('.pick .ball').getBoundingClientRect().top-S.top+parseFloat(getComputedStyle(stage).getPropertyValue('--diam'))/2)+'px');   // level with the marbles on the top shelf
      for(let k=0,y=first;k<1&&y+rise<=mouth.y-drop-30;k++,y+=rise+62){
        const fromLeft=k%2===0,a={x:fromLeft?-4:W+4,y},b={x:fromLeft?reach:W-reach,y:y+rise};
        add(bar(a,b,7,{restitution:.25}),'rail');svg+='<line class="rail-line" x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'"/>';
      }
    }
    Composite.add(engine.world,statics);
    art.setAttribute('viewBox','0 0 '+W+' '+H);
    art.innerHTML=svg;
  }

  // ---------- a marble in the air ----------
  function orb(idea,r){
    const holder=document.createElement('span');holder.innerHTML=ball(idea);
    const el=holder.firstElementChild;el.classList.add('loose-orb');el.style.setProperty('--diam',2*r+'px');
    stage.querySelector('.play-loose').append(el);return el;
  }
  const place=(el,x,y,r,angle=0,scale=1)=>el.style.transform='translate('+(x-r)+'px,'+(y-r)+'px) rotate('+angle+'rad) scale('+scale+')';
  function spawn(idea,el,r,pos,velocity){
    const body=Bodies.circle(pos.x,pos.y,r,{restitution:.3,friction:0,frictionAir:0,frictionStatic:0,density:.002,label:'marble'});
    Body.setVelocity(body,velocity);Body.setAngularVelocity(body,velocity.x*.012);
    const m={idea,el,body,r,r0:r,age:0,calm:0,nudges:0,lastY:pos.y};
    body.plugin.marble=m;Composite.add(engine.world,body);loose.set(idea.id,m);
    refresh();run();return m;
  }
  function removeLoose(m){Composite.remove(engine.world,m.body);m.el.remove();loose.delete(m.idea.id)}
  function slot(idea){return stage?.querySelector('.pick[data-id="'+idea.id+'"] .ball')}
  // A marble taken out of the jar hops from the jar's mouth back to its place on the shelf.
  function flyHome(idea){
    const home=slot(idea);if(!home||reduced.matches)return;
    const S=stage.getBoundingClientRect(),to=home.getBoundingClientRect(),dx=mouth.x-(to.left-S.left+to.width/2),dy=mouth.y-(to.top-S.top+to.height/2);
    home.animate([{transform:'translate('+dx+'px,'+dy+'px) scale(.6)',opacity:1},
      {transform:'translate('+dx*.45+'px,'+(dy*.45-50)+'px) scale(.9)',opacity:1,offset:.55},{transform:'none',opacity:1}],{duration:620,easing:'cubic-bezier(.3,.1,.3,1)'});
  }
  function remountJar(entry){const box=stage.querySelector('.jar-marbles');box.replaceChildren();mountJar(box,entry)}
  function enter(m){
    const v=Body.getVelocity(m.body),s=mouth.s,r=jarRadius(state.picked.size+1);
    const entry={x:clamp(75+(m.body.position.x-mouth.x)/s,41+r,109-r),velocity:cap({x:v.x/s,y:Math.max(2,v.y/s)},12),angle:m.body.angle,spin:Body.getAngularVelocity(m.body)};
    removeLoose(m);state.picked.add(m.idea.id);save();remountJar(entry);refresh();celebrate(m.idea);
    Track.send('add',{idea:m.idea.id,title:m.idea.title});
  }
  function celebrate(idea){
    Sound.land();buzz(12);
    const jar=stage.querySelector('.play-jar'),say=document.createElement('span');
    say.className='jar-say';say.setAttribute('aria-hidden','true');
    say.textContent=idea.title;jar.append(say);
    if(reduced.matches){setTimeout(()=>say.remove(),1600)}
    else{
      jar.querySelector('.bottle-inner').animate([{transform:'none'},{transform:'translateY(3px) rotate(1.8deg)',offset:.2},{transform:'translateY(-2px) rotate(-1.1deg)',offset:.5},{transform:'none'}],{duration:460,delay:70});
      say.animate([{opacity:0,translate:'0 8px',scale:'.9'},{opacity:1,translate:'0 0',scale:'1',offset:.15},{opacity:1,translate:'0 -6px',scale:'1',offset:.75},{opacity:0,translate:'0 -20px',scale:'1'}],{duration:1700,fill:'both'}).finished.then(()=>say.remove());
    }
    stage.querySelector('.play-live').textContent=idea.title+' — '+U.added;
    if(state.picked.size===1)tell('out',U.hintTakeOut);else if(state.picked.size===3)tell('three',U.hintThree);
  }
  function collide(e){
    for(const p of e.pairs){
      const a=p.bodyA.plugin.marble,b=p.bodyB.plugin.marble,m=a||b;if(!m)continue;
      const other=a?p.bodyB:p.bodyA,v=Body.getVelocity(m.body),o=other.isStatic?{x:0,y:0}:Body.getVelocity(other),power=Math.hypot(v.x-o.x,v.y-o.y);
      Sound.clink(power,other.label==='rail'?.6:other.label==='wall'?.72:1);
    }
  }
  function step(){
    Engine.update(engine,STEP);
    const gate=mouth.y+3*mouth.s;
    for(const m of [...loose.values()]){
      const {x,y}=m.body.position;
      if(m.lastY<gate&&y>=gate&&x>mouth.left&&x<mouth.right){enter(m);continue}
      m.lastY=y;m.age+=STEP;m.calm=Body.getSpeed(m.body)<.3?m.calm+STEP:0;
      // Glass has a top speed here. Without it a marble that fell a long way jumps clean over the jar and dawdles back.
      const v=Body.getVelocity(m.body),speed=Math.hypot(v.x,v.y);
      if(speed>TOP_SPEED)Body.setVelocity(m.body,{x:v.x*TOP_SPEED/speed,y:v.y*TOP_SPEED/speed});
      Body.setAngularVelocity(m.body,v.x/m.r*STEP/FRAME);       // the surfaces are frictionless so nothing dawdles; the spin is added by hand to match the travel
      // Right over the mouth, sideways motion dies away and the marble drops in.
      if(x>mouth.left&&x<mouth.right&&y>mouth.y-m.r-16)Body.setVelocity(m.body,{x:v.x*.86,y:Math.max(v.y,1.6)});
      if(!Number.isFinite(x+y)){removeLoose(m);refresh();continue}
      // Shrink to jar size on the way into the funnel, so the hand-over at the lip is invisible.
      const target=jarRadius(state.picked.size+1)*mouth.s;
      if(y>layout.funnelTop&&m.body.circleRadius>target+.1){const f=Math.max(target/m.body.circleRadius,.992);Body.scale(m.body,f,f);m.r=m.body.circleRadius}
      if(m.calm>420){m.calm=0;m.nudges++;Body.setVelocity(m.body,{x:(x<mouth.x?1:-1)*(1.6+Math.random()),y:-1.4})}   // come to rest somewhere: nudge it on
      if(m.age>9000||m.nudges>7||y>H+60)rescue(m);
    }
  }
  // The promise behind "cannot fail": whatever happens, the marble ends up in the jar.
  function rescue(m){
    Body.setPosition(m.body,{x:mouth.x,y:mouth.y-2});Body.setVelocity(m.body,{x:0,y:2.5});m.lastY=mouth.y-2;enter(m);
  }
  function tick(now){
    frame=0;if(!stage)return;
    if(!sheet.open){acc+=last?Math.min(50,now-last):STEP;while(acc>=STEP&&loose.size){acc-=STEP;step()}}
    last=now;
    for(const m of loose.values())place(m.el,m.body.position.x,m.body.position.y,m.r0,m.body.angle,m.r/m.r0);
    if(loose.size)frame=requestAnimationFrame(tick);
  }
  function run(){if(!frame){last=0;acc=0;frame=requestAnimationFrame(tick)}}

  // ---------- touching a marble ----------
  function bindPick(button){
    const idea=byId(button.dataset.id);
    button.onclick=e=>{if(e.detail===0)openIdea(idea)};       // keyboard: Enter or Space. Pointers are handled below.
    button.onpointerdown=e=>{
      if(e.button!==0)return;
      Sound.wake();
      const id=e.pointerId,sx=e.clientX,sy=e.clientY,free=!state.picked.has(idea.id)&&!loose.has(idea.id);
      let drag=null;
      try{button.setPointerCapture(id)}catch{}
      const move=ev=>{
        if(ev.pointerId!==id)return;
        if(!drag){if(!free||Math.hypot(ev.clientX-sx,ev.clientY-sy)<7)return;drag=carry(idea,button,ev)}
        drag.move(ev);
      };
      const end=ev=>{
        if(ev.pointerId!==id)return;
        for(const type of ['pointermove','pointerup','pointercancel','lostpointercapture'])button.removeEventListener(type,type==='pointermove'?move:end);
        if(drag)drag.end(ev);else if(ev.type==='pointerup')openIdea(idea);
      };
      // lostpointercapture covers a finger or mouse let go outside the window: the marble is still released, never left hanging.
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,end);
      button.addEventListener('pointermove',move);
    };
  }
  function grab(idea,button){
    const S=stage.getBoundingClientRect(),b=button.querySelector('.ball').getBoundingClientRect(),r=b.width/2;
    const origin={x:b.left-S.left+r,y:b.top-S.top+r},el=orb(idea,r);
    place(el,origin.x,origin.y,r);button.classList.add('away');
    return {S,r,origin,el};
  }
  // Carry the marble with your finger and let it go.
  function carry(idea,button,e){
    const {S,r,origin,el}=grab(idea,button),offset={x:origin.x-(e.clientX-S.left),y:origin.y-(e.clientY-S.top)};
    let x=origin.x,y=origin.y,vx=0,vy=0,lx=e.clientX,ly=e.clientY,lt=e.timeStamp;
    el.classList.add('held');
    return {
      move(ev){
        const dt=Math.max(8,ev.timeStamp-lt);
        vx=.4*vx+.6*(ev.clientX-lx)/dt;vy=.4*vy+.6*(ev.clientY-ly)/dt;lx=ev.clientX;ly=ev.clientY;lt=ev.timeStamp;
        x=clamp(ev.clientX-S.left+offset.x,r,W-r);y=Math.min(ev.clientY-S.top+offset.y,layout.railY(x)-r-3);
        place(el,x,y,r);
      },
      end(ev){
        el.classList.remove('held');
        if(ev.type==='pointercancel'){el.remove();button.classList.remove('away');return}
        const resting=ev.timeStamp-lt>120;                       // the finger stopped before letting go: no throw, just a drop
        spawn(idea,el,r,{x,y},resting?{x:0,y:0}:cap({x:vx*FRAME,y:vy*FRAME},13));
      }
    };
  }
  // The card's button, and a new marble of your own, go in without any dragging.
  function autoAdd(idea){
    if(state.picked.has(idea.id)||loose.has(idea.id))return;
    if(reduced.matches){state.picked.add(idea.id);save();remountJar();refresh();celebrate(idea);Track.send('add',{idea:idea.id,title:idea.title});return}
    const S=stage.getBoundingClientRect(),home=slot(idea)?.getBoundingClientRect();
    if(home){const r=home.width/2;return spawn(idea,orb(idea,r),r,{x:home.left-S.left+r,y:home.top-S.top+r},{x:(Math.random()-.5)*2.4,y:-2.2})}
    // No place on the shelf (your own marble, or one from another problem): it appears above the run.
    const shelves=stage.querySelector('.play-shelves').getBoundingClientRect(),r=21;
    const m=spawn(idea,orb(idea,r),r,{x:W/2+(Math.random()-.5)*W*.5,y:shelves.bottom-S.top+4},{x:(Math.random()-.5)*2,y:-1.5});
    m.el.animate([{opacity:0,scale:'.3'},{opacity:1,scale:'1'}],{duration:260,easing:'cubic-bezier(.2,.9,.3,1.2)'});
  }

  // ---------- sheets: an idea card, your own marble, the jar ----------
  let reading_card=null;                              // the card that is open right now, and since when
  function closeCard(){if(!reading_card)return;Track.send('read',{idea:reading_card.id,title:reading_card.title,ms:Math.round(performance.now()-reading_card.since)});reading_card=null}
  function openIdea(idea){
    state.read.add(idea.id);save();refresh();
    if(stage){stage.querySelector('.tap-hint')?.remove();for(const c of stage.querySelectorAll('.tap-cue'))c.classList.remove('tap-cue')}
    closeCard();reading_card={id:idea.id,title:idea.title,since:performance.now()};Track.send('open',{idea:idea.id,title:idea.title});
    const inJar=state.picked.has(idea.id);
    const body=idea.own?(idea.note?'<p class="own-note">'+esc(idea.note)+'</p>':''):cardSections(idea);
    openSheet('<div class="detail">'+ball(idea)+'<p class="cat">'+esc(idea.group.title)+(idea.own?' · '+esc(U.ownTag):'')+'</p><h2>'+esc(idea.title)+'</h2>'+body+
      '<button class="primary" data-card="'+(inJar?'out':'in')+'">'+esc(inJar?U.takeOut:U.dropIn)+'</button></div>');
    detail.querySelector('[data-card]').onclick=()=>{sheet.close();inJar?takeOut(idea):autoAdd(idea)};
  }
  function takeOut(idea){
    state.picked.delete(idea.id);jarRelease(idea.id);
    if(idea.own){ideas.splice(ideas.indexOf(idea),1);state.own.splice(state.own.indexOf(idea),1)}
    save();remountJar();refresh();if(!idea.own)flyHome(idea);
    Track.send('remove',{idea:idea.id,title:idea.title});
  }
  function openOwn(){
    if(state.own.length>=5)return hint(U.ownFull,6000);
    // Everything fits above a phone keyboard without scrolling, so the button is always in view: no intro text, the field
    // names sit inside the fields, and the problem is chosen by its marble instead of from a list.
    openSheet('<form class="detail own-form" novalidate><h2><span class="ball own" aria-hidden="true"></span>'+esc(U.ownTitle)+'</h2>'+
      '<input name="title" maxlength="60" required autocomplete="off" placeholder="'+esc(U.ownName)+'" aria-label="'+esc(U.ownName)+'">'+
      '<textarea name="note" rows="2" maxlength="280" placeholder="'+esc(U.ownNote)+'" aria-label="'+esc(U.ownNote)+'"></textarea>'+
      // The problem: the question is the field's visible label, the five marbles are the choices, and the chosen
      // problem is named under them in its colour (the chosen marble is lifted).
      '<fieldset class="own-areas"><legend>'+esc(U.ownArea)+'</legend><div class="own-area-choices">'+groups.map((g,k)=>'<label><input type="radio" name="g" value="'+k+'"'+(k===state.area?' checked':'')+' aria-label="'+esc(g.title)+'">'+ball({g:k,shade:0})+'</label>').join('')+'</div>'+
      '<output class="own-area-name" style="--tint:'+groups[state.area].tint+'">'+esc(groups[state.area].title)+'</output></fieldset>'+
      '<button class="primary">'+esc(U.ownMake)+'</button></form>');
    const form=detail.querySelector('form');
    form.onchange=()=>{const out=form.querySelector('.own-area-name'),g=groups[+form.g.value];out.textContent=g.title;out.style.setProperty('--tint',g.tint)};
    form.onsubmit=e=>{
      e.preventDefault();
      const title=form.title.value.trim().replace(/\s+/g,' ');
      if(!title){form.title.focus();return}
      const idea=addOwnIdea({id:'own-'+Date.now().toString(36),title,note:form.note.value.trim(),g:+form.g.value});
      Track.send('own',{idea:idea.id,title:idea.title,note:idea.note});
      save();sheet.close();autoAdd(idea);
    };
    form.title.focus();
  }
  // Tapping the jar shows what is in it. Sending is its own, shorter step.
  // A card opened from the jar: a tap on the left third of the screen goes back to the jar, like stepping back
  // through stories. Buttons and links keep their own job.
  let backToJar=false;
  sheet.addEventListener('click',e=>{
    if(!backToJar||e.clientX>innerWidth/3||e.target.closest('button,a,input,textarea,select,summary'))return;
    e.stopImmediatePropagation();openJar();
  },true);
  sheet.addEventListener('close',()=>{backToJar=false});
  function openJar(){
    backToJar=false;closeCard();
    const picked=[...state.picked].map(byId),{text,counts}=reading();
    if(!picked.length)return openSheet('<div class="detail jar-detail"><h2>'+esc(jarTitle())+'</h2><p>'+esc(U.emptyHint)+'</p></div>');
    openSheet('<div class="detail jar-detail"><h2>'+esc(jarTitle())+'</h2><p class="reading">'+esc(text)+'</p>'+
      '<div class="mix" aria-hidden="true">'+counts.map(c=>'<i style="flex:'+c.n+';background:'+c.tint+'"></i>').join('')+'</div>'+
      picked.map(i=>'<div class="item"><button class="open-idea" data-open="'+esc(i.id)+'">'+ball(i)+'<span>'+esc(i.title)+(i.own?' <em>'+esc(U.ownTag)+'</em>':'')+'</span></button><button data-remove="'+esc(i.id)+'">'+esc(U.takeOutShort)+'</button></div>').join('')+
      '<button class="primary jar-go">'+esc(U.send)+'</button></div>');
    for(const b of detail.querySelectorAll('[data-remove]'))b.onclick=()=>{takeOut(byId(b.dataset.remove));openJar()};
    // A marble in the jar opens its idea card again, the same card as on the shelf.
    for(const b of detail.querySelectorAll('[data-open]'))b.onclick=()=>{openIdea(byId(b.dataset.open));backToJar=true};
    detail.querySelector('.jar-go').onclick=openSend;
  }
  // One field and one button. A note is optional and tucked away; the name is only asked for if the first page did not get one.
  function openSend(){
    if(!state.picked.size)return openJar();
    const sealed=state.sent===signature(),booking=window.IDEA_MAP.send?.bookingUrl,count=state.picked.size;
    openSheet('<form class="detail send-form" novalidate><h2>'+esc(U.sendTitle)+'</h2>'+
      '<p class="send-summary">'+esc(fill(count===1?U.sendCountOne:U.sendCount,{n:count}))+' '+esc(reading().text)+'</p>'+
      (state.fullName?'':'<label>'+esc(U.sendName)+'<input name="name" autocomplete="name" maxlength="80"></label>')+
      '<label>'+esc(U.sendEmail)+'<input name="email" type="email" inputmode="email" autocomplete="email" maxlength="200" value="'+esc(state.email)+'"></label>'+
      '<details class="send-note"><summary>'+esc(U.sendNoteToggle)+'</summary><textarea name="note" rows="3" maxlength="800" aria-label="'+esc(U.sendNote)+'"></textarea></details>'+
      '<label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>'+
      '<button class="primary">'+esc(sealed?U.sendAgain:U.sendButton)+'</button>'+
      (booking?'<p class="send-or">'+esc(U.sendOr)+'</p><button type="button" class="coffee">'+esc(U.coffee)+'</button><p class="coffee-hint">'+esc(U.coffeeHint)+'</p>':'')+
      '<p class="send-status" role="status">'+(sealed?esc(U.sendDone):'')+'</p><p class="fine">'+esc(U.sendPrivacy)+' '+legalLink()+'</p></form>');
    const form=detail.querySelector('form');
    form.onsubmit=e=>{e.preventDefault();send(form,false)};
    form.email.oninput=()=>{form.querySelector('.send-status').textContent=''};
    const coffee=form.querySelector('.coffee');
    if(coffee)coffee.onclick=()=>{
      // With a backend the jar is written into the calendar invite, and the email address is what links the two (backend/Code.gs).
      // So it is asked for before the calendar opens.
      if(window.IDEA_MAP.send?.endpoint&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim())){
        form.querySelector('.send-status').textContent=U.coffeeNeedEmail;form.email.focus();return;
      }
      // Open the calendar straight away, inside the click, or the browser blocks it as a pop-up. The jar follows in the background.
      window.open(booking,'_blank','noopener');send(form,true);
    };
    if(!sealed)form.email.focus({preventScroll:true});
  }
  async function send(form,coffee){
    const status=form.querySelector('.send-status'),button=form.querySelector('.primary'),email=form.email.value.trim(),name=form.elements.name?.value.trim().replace(/\s+/g,' ');   // form.name alone would be the form's own name attribute
    const valid=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    // A plain send needs an email to get a reply. Over coffee it is checked before the calendar opens (see openSend); without a backend it stays optional.
    if(!valid&&(!coffee||email)){status.textContent=U.sendNeedEmail;form.email.focus();return}
    if(name){state.fullName=name;state.name=name.split(' ')[0]}
    if(valid)state.email=email;
    save();refresh();
    const picked=[...state.picked].map(byId),note=form.note.value.trim();
    const payload={visitor:Track.visitor,name:state.fullName,email:valid?email:'',note,coffee,worried:state.worried,reading:reading().text,website:form.website.value,
      ideas:picked.filter(i=>!i.own).map(i=>({id:i.id,title:i.title,problem:i.group.title})),
      own:picked.filter(i=>i.own).map(i=>({title:i.title,note:i.note,problem:i.group.title}))};
    const endpoint=window.IDEA_MAP.send?.endpoint;
    button.disabled=true;status.textContent=U.sending;
    try{
      if(!endpoint||location.protocol==='file:')throw new Error('no backend here');
      // No Content-Type header: the JSON goes as plain text. That keeps it a "simple" request the browser sends without
      // asking permission first (a preflight), which the Google Apps Script backend (backend/Code.gs) could not answer.
      const response=await fetch(endpoint,{method:'POST',body:JSON.stringify(payload)});
      if(!response.ok)throw new Error('refused');
      state.sent=signature();save();refresh();
      status.textContent=coffee?U.coffeeDone:U.sendDone;button.textContent=U.sendAgain;Sound.land();
      finale(coffee?U.coffeeDone:U.sendDone);
    }catch{
      // No backend, or it is down: the visitor can still get their jar to Mareike by hand.
      // Without a backend at all, a plain send hands the jar to the visitor's own email app, addressed and written.
      // That is not "sent" yet (they still press send there), so the ending says exactly that.
      const byMail=!endpoint&&!coffee&&A.email;
      if(byMail){
        location.href='mailto:'+A.email+'?subject='+encodeURIComponent(U.mailSubject)+'&body='+encodeURIComponent(jarText(note));
        finale(U.sendMail,true);
      }
      status.textContent=byMail?U.sendMail:coffee&&!endpoint?U.coffeeLocal:U.sendFailed;
      if(!form.querySelector('.copy-jar')){
        const copy=document.createElement('button');copy.type='button';copy.className='subtle copy-jar';copy.textContent=U.copy;
        copy.onclick=async()=>{
          try{await navigator.clipboard.writeText(jarText(note));copy.textContent=U.copied}
          catch{const area=document.createElement('textarea');area.value=jarText(note);area.rows=6;area.setAttribute('aria-label',U.copyFallback);copy.replaceWith(area);area.select()}
        };
        status.after(copy);
      }
    }
    button.disabled=false;
  }

  // ---------- the ending ----------
  // The jar is corked and lifted off the page. Then the closing screen: the visitor's sealed jar (a copy, with its marbles,
  // cork and bow) and a goodbye by name.
  // "Keep exploring" brings the game back.
  let leaving=null;
  function finale(text,unsent){
    if(sheet.open)sheet.close();
    if(!stage)return;
    endFinale(true);
    const jar=stage.querySelector('.play-jar'),booking=window.IDEA_MAP.send?.bookingUrl;
    const card=document.createElement('div');card.className='finale';card.setAttribute('role','status');
    card.innerHTML='<div class="finale-jar" aria-hidden="true"></div>'+
      '<h2>'+esc(unsent?U.finaleReady:state.name?named(U.finaleTitle):U.finaleTitleGuest)+'</h2><p>'+esc(text)+'</p>'+
      (booking?'<a class="primary" href="'+esc(booking)+'" target="_blank" rel="noopener">'+esc(U.finaleCoffee)+'</a>':'')+
      '<button class="subtle" type="button">'+esc(U.finaleStay)+'</button>';
    card.querySelector('.finale-jar').append(jar.querySelector('.bottle').cloneNode(true));
    stage.append(card);stage.classList.add('sent');jar.classList.add('sealed');
    card.querySelector('button').onclick=()=>endFinale();
    if(reduced.matches)return;
    const soft='cubic-bezier(.2,.8,.2,1)';
    // 1. cork in, then the gift bow tied on (the "sealed" and "sent" styles), 2. the jar dips as if picked up and leaves through the top, 3. the page clears,
    // 4. the sealed jar is there, 5. the words.
    leaving=jar.animate([{transform:'none'},{transform:'translateY(9px)',offset:.2,easing:'cubic-bezier(.55,0,.9,.45)'},{transform:'translateY(-125vh) rotate(7deg)'}],{duration:1300,delay:1150,fill:'forwards'});
    card.animate([{opacity:0},{opacity:1}],{duration:450,delay:1800,fill:'backwards'});
    card.querySelector('.finale-jar').animate([{opacity:0,transform:'scale(.82)'},{opacity:1,transform:'none'}],{duration:620,delay:2100,easing:soft,fill:'backwards'});
    for(const [n,el] of [...card.querySelectorAll('h2,p,.primary,.subtle')].entries())
      el.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:480,delay:2600+n*110,easing:'ease-out',fill:'backwards'});
  }
  function endFinale(quiet){
    leaving?.cancel();leaving=null;
    if(!stage)return;
    const card=stage.querySelector('.finale');
    if(!card)return;
    card.remove();stage.classList.remove('sent');refresh();
    if(!quiet&&!reduced.matches)stage.querySelector('.play-jar').animate([{transform:'translateY(-60vh)'},{transform:'none'}],{duration:620,easing:'cubic-bezier(.3,.9,.3,1.12)'});
  }

  // ---------- start and stop ----------
  // The little intro before the game: one question, and the five problems as ways in.
  // It is shown once per visit; replaying the story brings it back.
  let asked=false;
  try{asked=sessionStorage.getItem('idea-map-asked')==='yes'}catch{}
  function ask(){
    const row=(k,title,sub,marble)=>'<button class="ask-row" data-ask="'+k+'">'+marble+'<span class="ask-text"><b>'+esc(title)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><i aria-hidden="true">›</i></button>';
    app.innerHTML='<section class="world play ask"><div class="ask-stage"><h1 tabindex="-1">'+esc(state.name?named(U.askTitleNamed):U.askTitle).replace(/\n/g,'<br>')+'</h1>'+
      // The one written hint on the site, by choice: tapping a row looks like a single answer, but the jar takes as many as you like.
      (U.askBody?'<p class="ask-sub">'+esc(U.askBody)+'</p>':'')+
      '<div class="ask-list">'+groups.map((g,k)=>row(k,g.title,'',ball({g:k,shade:0}))).join('')+'</div>'+   // no "Something else" row: own ideas are added from the shelves
      '<nav class="ask-nav"><button class="subtle" data-action="back">'+esc(U.back)+'</button></nav></div></section>';   // app.js handles data-action="back"
    for(const b of app.querySelectorAll('.ask-row'))b.onclick=()=>{
      const own=b.dataset.ask==='own';
      asked=true;try{sessionStorage.setItem('idea-map-asked','yes')}catch{}
      if(!own){state.area=+b.dataset.ask;save()}
      Track.send('ask',{title:own?U.askOther:groups[state.area].title});
      Sound.wake();mount();if(own)openOwn();
    };
    if(!reduced.matches)for(const [n,b] of [...app.querySelectorAll('.ask-row')].entries())
      b.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:420,delay:120+n*55,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
  }
  function mount(){
    unmount();
    try{sessionStorage.setItem('idea-map-reached','yes')}catch{}       // a reload brings the visitor back here (see the end of app.js)
    if(!asked)return ask();
    app.innerHTML='<section class="world play"><div class="play-stage">'+
      // One way to move between the five problems: they lie side by side. A marble of the next one looks in at each
      // edge (tap it, swipe, or ← →), and a dot per problem in the problem colours under the shelves, with a faint ‹ › either
      // side, say where you are. No counter, no tab row, no written hint (see renderArea and the end of mount).
      '<header class="play-head"><p class="area-ask">'+esc(U.areaAsk)+'</p><div class="area-title"><button class="area-step" data-step="-1" aria-label="'+esc(U.areaPrev)+'">‹</button>'+
      '<h1 tabindex="-1"></h1><button class="area-step" data-step="1" aria-label="'+esc(U.areaNext)+'">›</button></div></header>'+
      '<div class="play-shelves"></div>'+
      '<button class="area-peek" data-step="-1" aria-label="'+esc(U.areaPrev)+'"></button><button class="area-peek" data-step="1" aria-label="'+esc(U.areaNext)+'"></button>'+
      '<svg class="play-art" aria-hidden="true"></svg>'+
      '<button class="play-jar"><span class="bottle" aria-hidden="true"><span class="bottle-inner"><span class="bottle-scale">'+bottleArt+'</span><span class="cork"></span><span class="jar-tag"></span>'+'<span class="jar-bow"><svg viewBox="0 0 150 196"><defs><linearGradient id="ribbon" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c8414c"/><stop offset="1" stop-color="#8f2430"/></linearGradient></defs><path d="M38 24.5 Q75 28 112 24.5 L112 30.5 Q75 34 38 30.5 Z" fill="url(#ribbon)"/><g transform="translate(104 27.5) rotate(22) scale(1.2) translate(-75 -28)"><path d="M73 30 L63 53 L67.5 50 L70 54.5 L76.5 31 Z M77 30 L87 52 L82.5 49.5 L80 54 L73.5 31 Z" fill="#9e2a35"/><path d="M75 28 C61 11 43 15 49 26 C53 33 66 31 75 28 Z M75 28 C89 11 107 15 101 26 C97 33 84 31 75 28 Z" fill="url(#ribbon)"/><path d="M74 27.5 C64 18 53 19 54 25 M76 27.5 C86 18 97 19 96 25" fill="none" stroke="#7c1c27" stroke-width="1.1" stroke-linecap="round" opacity=".55"/><path d="M58 19.5 C62 17.5 66 19 69 22 M92 19.5 C88 17.5 84 19 81 22" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".35"/><ellipse cx="75" cy="28.3" rx="5.2" ry="4.4" fill="#a92f3a"/><ellipse cx="74" cy="27" rx="2.2" ry="1.3" fill="#fff" opacity=".3"/></g></svg></span>'+'</span></span>'+
      '<span class="jar-label"><span class="jar-name"></span><span class="jar-count">0</span></span><span class="jar-open">'+esc(U.jarOpen)+'</span></button>'+
      '<button class="play-back subtle" data-action="restart">'+esc(U.back)+'</button>'+
      '<button class="send-jar primary" hidden></button>'+
      '<div class="play-loose"></div><p class="play-live" aria-live="polite"></p></div></section>';
    stage=app.querySelector('.play-stage');art=stage.querySelector('.play-art');
    engine=Engine.create({gravity:{x:0,y:GRAVITY},positionIterations:8});statics=[];
    Events.on(engine,'collisionStart',collide);
    renderArea();remountJar();layout();refresh();
    document.fonts?.ready.then(()=>{if(stage)layout()});
    Track.send('game');
    for(const b of stage.querySelectorAll('.area-peek,.area-step'))b.onclick=()=>setArea(state.area+ +b.dataset.step);
    // ← → move between the problems too (the story's own arrow keys stop before this screen).
    document.removeEventListener('keydown',areaKeys);document.addEventListener('keydown',areaKeys);
    stage.querySelector('.play-jar').onclick=openJar;
    stage.querySelector('.send-jar').onclick=openSend;
    // Swiping sideways anywhere on the page moves between areas. A swipe that starts on a marble or a button stays
    // theirs (dragging a marble off the shelf), and a mostly vertical stroke is not a swipe.
    let swipe=null;
    stage.onpointerdown=e=>{swipe=e.isPrimary&&!e.target.closest('button,a,input,textarea,select')?{id:e.pointerId,x:e.clientX,y:e.clientY}:null};
    stage.onpointerup=e=>{
      if(!swipe||e.pointerId!==swipe.id)return;
      const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;
      if(Math.abs(dx)>45&&Math.abs(dx)>1.5*Math.abs(dy))setArea(state.area+(dx<0?1:-1));
    };
    stage.onpointercancel=()=>{swipe=null};
    // Nothing says that a marble holds a card, and a first visitor never tapped one. So the first marble hops once,
    // a visual invitation to tap it. It does not open its card by itself: a card appearing unasked confused visitors.
    if(!cardShown&&!state.read.size&&!reduced.matches){
      const mine=stage;
      setTimeout(()=>{
        const first=mine.querySelector('.pick:not(.add-own)');
        if(stage!==mine||sheet.open||state.read.size||loose.size||!first)return;
        cardShown=true;
        first.querySelector('.ball').animate([{translate:'0 0',scale:'1'},{translate:'0 -16px',scale:'1.12',offset:.4},{translate:'0 0',scale:'1',offset:.8},{translate:'0 -4px',offset:.9},{translate:'0 0'}],{duration:620,easing:'ease-out'});
      },1200);
    }
  }
  let cardShown=false;
  function unmount(){
    leaving?.cancel();leaving=null;
    if(state.step!==13){asked=false;try{sessionStorage.removeItem('idea-map-asked');sessionStorage.removeItem('idea-map-reached')}catch{}}   // leaving for the story: ask again next time
    if(!stage)return;
    cancelAnimationFrame(frame);frame=0;clearTimeout(hintTimer);loose.clear();stage=null;engine=null;
    document.removeEventListener('keydown',areaKeys);
    document.querySelector('#mastTools').innerHTML='';
  }
  sheet.addEventListener('close',closeCard);
  window.addEventListener('pagehide',closeCard);
  window.addEventListener('resize',()=>{if(!stage)return;for(const m of [...loose.values()])rescue(m);layout()});
  return {mount,unmount,_test:{loose,get mouth(){return mouth},get size(){return {W,H}},autoAdd,reading}};
})();
