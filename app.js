// iPhone Chrome and Brave size 100svh as if their toolbars were not there, so the page ended up a little taller than what
// you can see: a tiny scroll, and the bottom buttons sitting under the toolbar. innerHeight is the visible height.
{const setVh=()=>document.documentElement.style.setProperty('--vh',innerHeight+'px');setVh();addEventListener('resize',setVh);addEventListener('orientationchange',setVh)}
'use strict';
const {welcome:W,about:A,story:S,ui:U,groups}=window.IDEA_MAP;
document.querySelector('.mast .face').setAttribute('aria-label',A.open);
// Header: who, then what. On a phone the two stack (see .mast-who in style.css).
{
  const title=document.querySelector("#siteTitle");
  for(const [cls,text] of [['mast-who',A.name],['mast-dot','·'],['mast-what',W.siteTitle]]){
    const part=document.createElement('span');part.className=cls;part.textContent=text;
    if(cls==='mast-dot')part.setAttribute('aria-hidden','true');
    title.append(part);
  }
}
const ideas=groups.flatMap((group,g)=>group.ideas.map((i,index)=>({...i,g,group,shade:index%6})));
const app=document.querySelector('#app'),sheet=document.querySelector('#sheet'),detail=document.querySelector('#detail');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={step:0,name:'',fullName:'',email:'',picked:new Set(),read:new Set(),own:[],area:0,sent:'',worried:'',paused:false};
// A visitor's own marble is an idea like any other, flagged `own`. It lives in the same list so the jar can draw it.
const otherArea=()=>({id:'other',title:window.IDEA_MAP.ui.ownOtherArea,tint:'#8b8680'});
function addOwnIdea({id,title,note,g}){
  // g -1: none of the six problems ("Something else", the grey marble in the form).
  g=(g|0)<0?-1:Math.min(groups.length-1,g|0);
  const idea={id:String(id),title:String(title).slice(0,60),note:String(note||'').slice(0,280),g,group:g<0?otherArea():groups[g],shade:0,own:true};
  ideas.push(idea);state.own.push(idea);return idea;
}
try{
  const saved=JSON.parse(sessionStorage.getItem('idea-map-visual')||'{}');
  state.fullName=String(saved.fullName||saved.name||'');state.name=state.fullName.trim().split(/\s+/)[0];
  state.email=String(saved.email||'');state.worried=String(saved.worried||'');state.sent=String(saved.sent||'');state.area=Math.max(0,Math.min(groups.length-1,saved.area|0));
  for(const own of (saved.own||[]).slice(0,5))addOwnIdea(own);
  const known=id=>ideas.some(i=>i.id===id);
  state.picked=new Set((saved.ids||[]).filter(known));state.read=new Set((saved.read||[]).filter(known));
}catch{}
function save(){
  try{sessionStorage.setItem('idea-map-visual',JSON.stringify({
    fullName:state.fullName,email:state.email,worried:state.worried,sent:state.sent,area:state.area,ids:[...state.picked],read:[...state.read],
    own:state.own.map(({id,title,note,g})=>({id,title,note,g}))
  }))}catch{}
}
const esc=v=>String(v).replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
// The glass belongs to the problem, not to its place in the list: the pictures are numbered (swirl-<n>-<shade>) by problem id.
const glassOf={control:0,connection:1,thinking:2,work:3,equity:4,misuse:5},glass=g=>glassOf[groups[g]?.id]??g;
// The purple problem (0) has its own, more varied shades for marbles 1–5: periwinkle, orchid, deep indigo, lilac and wine (swirl-0-v1…v5).
function marbleImage(g,shade){const n=glass(g);return n===0&&shade>0?'assets/swirl-0-v'+shade+'.webp':'assets/swirl-'+n+'-'+shade+'.webp'}
function ball(idea){return idea.own?'<span aria-hidden="true" class="ball own"></span>':'<span aria-hidden="true" class="ball" style="--glass:url('+marbleImage(idea.g,idea.shade)+')"></span>'}
function btn(key,label,cls='action'){return '<button class="'+cls+'" data-action="'+key+'">'+esc(label)+'</button>'}
function named(v){return v.replace('{name}',()=>state.name)}
const jarTitle=()=>state.name?named(U.personalJar):U.jar;
// Story controls. "Skip to the ideas" is there for visitors in a hurry: bottom right, where the eye looks for "next".
// (There is no Pause any more: the scenes are short and wait for a tap at the end anyway.)
// The ‹ › slide arrows of the story and the marble field (style.css, .slide-arrow; app.js handles data-action back/forward).
function slideArrows(){
  const arrow=(dir,key,label)=>'<button class="slide-arrow '+dir+'" data-action="'+key+'" aria-label="'+esc(label)+'"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="'+(dir==='prev'?'M14.5 5.5 8 12l6.5 6.5':'M9.5 5.5 16 12l-6.5 6.5')+'"/></svg></button>';
  return arrow('prev','back',U.back)+arrow('next','forward',U.next);
}
function controls(label=U.next){
  const early=state.step>=1&&state.step<12;
  // In the story and on the marble field the ‹ arrow goes back, so there is no Back link there (owner, 26 Nov).
  return '<nav class="controls">'+(state.step>=1&&state.step<=12?'':btn('back',U.back,'subtle'))+(early?btn('skip',U.skip,'subtle skip'):'')+btn('next',label,'keyboard-next')+'</nav>';
}
let raf=0;
function animate(duration,paint,done){
  cancelAnimationFrame(raf);let elapsed=0,last=0;
  function tick(now){
    if(last&&!state.paused&&!document.hidden&&!sheet.open)elapsed+=Math.min(now-last,80);
    last=now;
    const f=reduced.matches?1:Math.min(1,elapsed/duration);
    paint(f);
    if(f<1)raf=requestAnimationFrame(tick);
    else if(done)done();
  }
  paint(reduced.matches?1:0);raf=requestAnimationFrame(tick);
}
let lastCamera=null,lastPose=null,lastScene=0,coverX=-300,openerStart=-115,rig=null;
// "Are you worried?" is answered with the marble itself. While the question stands, the visitor can drag the marble along the
// rail: back up the calm slope, or towards the edge. Let go and gravity takes it: it always ends up at the brink, later or sooner.
// worry = {x: place on the rail, v: speed, dragging, anchor: where the camera stays, level: 0 calm … 1 at the edge}.
let worry=null,rolledIn=false,dragged=false,nudgedAt=0,askedAt=0;   // askedAt: when the question appeared (0 = not yet)
let redraw=null;   // repaints the current scene once; with reduced motion nothing else does (the chevrons, the dragged marble)
let goPass=false;  // set just before go() by keyboard, Continue and Skip: they may leave "Are you worried?" without an answer
// Where in the collapse scene (f, 0 to 1) the run shatters, and where "What if…" takes over: .4 earlier (about one and a half seconds
// of "What if…" on its own before the burst, see the duration of scene 3 below).
const burstAt=MarbleRun.fall.start+(1-MarbleRun.fall.start)*(MarbleRun.impact()-MarbleRun.fall.from)/(1-MarbleRun.fall.from),whatIfAt=burstAt-.4;
const worryShake=.65;  // strength of the worry shaking, on the run and the camera (1 felt too strong in testing)
let worryFelt=0;   // how hard the run was shaking when the marble went over the edge (carried into the next scene)
const worryBack=150;   // how far back from the brink the marble can be pulled, in drawing units
const worryLevel=x=>MarbleRun.clamp((x-(MarbleRun.brink-worryBack))/worryBack);
function worryStep(now){
  const w=worry;
  if(!w||w.dragging||!w.released){if(w)w.last=now;return}
  const dt=Math.min(.05,(now-w.last)/1000);w.last=now;
  // Gravity along the rail: the steeper it gets towards the brink, the harder it pulls.
  const slope=(MarbleRun.ground(w.x+1)-MarbleRun.ground(w.x-1))/2;
  w.v+=1300*slope*dt;w.x+=w.v*dt;
  const back=MarbleRun.brink-worryBack;
  if(w.x<back){w.x=back;w.v=-w.v*.3}
  if(w.x>=MarbleRun.brink&&!w.done){
    // Over the edge: this is the answer, and the story goes on without another tap.
    w.done=true;rolledIn=true;worryFelt=worryLevel(w.x);
    state.worried=w.answer;save();Track.send('worried',{answer:w.answer,level:+w.level.toFixed(2)});
    setTimeout(()=>{if(state.step===2)go(3)},0);
  }
}
// Every scene waits for a click, so the marble starts from rest and comes to rest: speed ramps up, holds, ramps down.
function settle(u){const r=.16,v=1/(1-r);return u<r?v*u*u/(2*r):u>1-r?1-v*(1-u)*(1-u)/(2*r):v*(u-r/2)}
function machine(stage,step){
  // The sculpture is drawn once per stage and then only moved, so scenes flow into each other without a redraw.
  if(!rig||rig.stage!==stage){
    stage.innerHTML='<svg aria-hidden="true" preserveAspectRatio="xMidYMid meet">'+MarbleRun.art()+'</svg>';
    const nodes=new Map();
    for(const node of stage.firstElementChild.querySelectorAll('[id]'))nodes.set(node.id,node);
    rig={stage,svg:stage.firstElementChild,nodes,cracks:[...stage.querySelectorAll('.crack')].map(el=>({el,x:+el.dataset.x}))};
  }
  const {svg,nodes}=rig;
  const closeUp=step<=2,from=lastScene;
  const carried=!!lastCamera&&Math.abs(step-from)===1;
  const target=step===0?[-300,48,660]:MarbleRun.camera[step];
  const start=carried?lastCamera:target;
  const entryPose=carried&&from>0?lastPose:null;
  // Breaking and mending are one clock run in two directions: pick it up wherever the other scene left it.
  const f0=!entryPose?0:step===4&&from===3?1-entryPose.breakage:step===3&&from===4?MarbleRun.fall.start+(1-MarbleRun.fall.start)*MarbleRun.clamp((entryPose.breakage-MarbleRun.fall.from)/(1-MarbleRun.fall.from)):0;
  // (Scene 1 is long enough that "Fast." lands about 2.5s in; scene 3 is slowed down so "I am.", "What if…" and the
  // answer each have a moment; scene 6 is "Because:", words only.)
  const duration=Math.max(700,[0,4800,3400,4400,2400,2700,1400,4800,4400,4000,3700,4400][step]*(1-f0));
  // A scene left early hands its marble over: for half a second the pose glides from where it was to where it belongs.
  const joinSpan=f0?0:MarbleRun.clamp(520/duration);
  // "I am." and the marble goes: only a breath at the brink while the words change, then it races down the drop.
  const hold=step===3&&!f0&&!rolledIn?1100:0;
  // The worry the visitor just gave goes on into "So am I.": the run keeps shaking and the page stays red until the
  // run shatters. Only when the marble was rolled over the edge, not when coming back from a later scene.
  const carriedWorry=step===3&&!f0&&rolledIn?worryFelt:0;
  rolledIn=false;worry=null;askedAt=0;nudgedAt=0;redraw=null;
  lastScene=step;
  // f is the place in the scene's choreography, u the plain time since the scene began (both 0 to 1).
  function paint(f,u){
    let pose=MarbleRun.pose(Math.max(1,step),f);
    if(step===0||step===1){
      const x=step===0?coverX:MarbleRun.mix(openerStart,150,MarbleRun.surge(f));
      pose={...pose,x,y:MarbleRun.ground(x)-25,spin:(x+115)*180/(19*Math.PI)};
    }
    if(entryPose&&u<joinSpan){
      const join=MarbleRun.ease(u/joinSpan);
      // Back from a scene where the marble had already left the picture (the bridge, or the end of misuse): it does not fly
      // back in, it just appears where this scene has it (the top of the ramp), while the fresh marble of the bridge fades away.
      for(const key of entryPose.gone&&!pose.gone?['breakage','gate','bridge','balance']:['x','y','spin','breakage','gate','bridge','balance']){
        pose[key]=MarbleRun.mix(entryPose[key],pose[key],join);
      }
    }
    // The visitor has the marble: it is where they put it, and the run shivers more the closer it is to the edge.
    let follow=pose,halo=null,cue=null,felt=0,red=0;
    if(step===2&&worry){
      worryStep(performance.now());
      const at=MarbleRun.ride(Math.min(worry.x,MarbleRun.brink+40));
      follow=worry.anchor;
      // The answer is felt while it is given: towards the edge the run shakes hard and cracks spread ahead of the marble,
      // back up the slope it calms down and the cracks close again. (`front`: cracks left of this x are drawn.)
      felt=worryLevel(worry.x);
      pose={...pose,x:at.x,y:at.y,spin:(worry.x+115)*180/(19*Math.PI),tremor:.2+2.6*worryShake*felt**1.4,front:MarbleRun.mix(170,MarbleRun.brink+130,felt)};
    }
    else if(step===2&&askedAt){
      // Nobody is told to drag. The marble rocks on the spot instead, like something that wants to be picked up, between
      // two faint chevrons (‹ ›) that lean the way it rolls. All of it stops at the first drag (worry is set then).
      const now=performance.now(),move=reduced.matches?0:1,since=move?(now-askedAt)/1000:9,rock=move*Math.min(1,since/.8)*13*Math.sin(since*2.6);
      const hop=nudgedAt?Math.min(1,(now-nudgedAt)/420):1;
      const at=MarbleRun.ride(MarbleRun.brink-10+rock);
      pose={...pose,x:at.x,y:at.y-22*4*hop*(1-hop),spin:(MarbleRun.brink-10+rock+115)*180/(19*Math.PI)};
      // A ring opens around the marble every couple of seconds: "this one can be picked up".
      const beat=(since%2.2)/1.1;
      if(move)halo={x:at.x,y:pose.y,scale:1+.75*Math.min(1,beat),opacity:beat<1?.55*(1-beat)*Math.min(1,since/.6):0};
      cue={x:at.x,y:at.y,lean:move*Math.cos(since*2.6),opacity:Math.min(1,since/.6)};
    }
    else if(carriedWorry&&pose.breakage<MarbleRun.impact()+.07){
      // Still the visitor's worry: same shaking and red as on the scene before, easing out quickly once the run shatters.
      felt=carriedWorry*(1-MarbleRun.clamp((pose.breakage-MarbleRun.impact())/.07));
      pose={...pose,tremor:Math.max(pose.tremor||0,(.2+2.6*worryShake*felt**1.4)*(felt>0))};
    }
    // The red frame stays while the run lies broken (only the shaking stops at the burst): it comes up with the burst, or
    // stays on from the worry before it, and only goes as the run mends in the next scene.
    if(step===3||step===4)red=Math.max(MarbleRun.clamp((pose.breakage-MarbleRun.impact())/.07),pose.breakage>=MarbleRun.impact()?carriedWorry:0);
    lastPose=pose;
    // Worry: the run shivers under the marble (which rides along with its section) and cracks draw themselves in ahead of it.
    pose.phase=performance.now()/1000;
    if(reduced.matches)pose.tremor=0;
    let shown=pose;
    if(pose.tremor){const [dx,dy]=MarbleRun.quake(0,pose.phase,pose.tremor);shown={...pose,x:pose.x+dx,y:pose.y+dy}}
    for(const {el,x} of rig.cracks){
      const grown=MarbleRun.clamp((pose.front-x)/50);
      el.setAttribute('stroke-dashoffset',1-grown);el.setAttribute('opacity',grown?.9:0);
    }
    stage.closest('.stage')?.classList.toggle('stressed',pose.stressReached);
    stage.closest('.stage')?.style.setProperty('--worry',Math.max(felt,red).toFixed(3));   // the page reddens and the answer grows with it (style.css)
    for(const [id,value] of Object.entries(MarbleRun.transforms(shown)))nodes.get(id).setAttribute('transform',value);
    for(const [id,value] of Object.entries(MarbleRun.fades(pose)))nodes.get(id).style.opacity=value;   // style, so the CSS transition softens a marble leaving
    const ring=nodes.get('halo');ring.setAttribute('opacity',halo?halo.opacity:0);
    if(halo)ring.setAttribute('transform','translate('+halo.x.toFixed(2)+' '+halo.y.toFixed(2)+') scale('+halo.scale.toFixed(3)+')');
    const chevrons=nodes.get('dragcue');chevrons.setAttribute('opacity',cue?cue.opacity:0);
    if(cue){
      chevrons.setAttribute('transform','translate('+cue.x.toFixed(2)+' '+cue.y.toFixed(2)+')');
      for(const [id,side] of [['cueL',-1],['cueR',1]]){const k=Math.max(0,side*cue.lean);nodes.get(id).setAttribute('opacity',(.5+.5*k).toFixed(2));nodes.get(id).setAttribute('transform','translate('+(side*3*k).toFixed(2)+' 0)')}
    }
    const rect=stage.getBoundingClientRect(),mobile=rect.width<700;
    if(!rect.width)return;   // not laid out (hidden tab): there is no camera to aim yet
    // In the collapse scene the camera stays close for the first moment of the plunge, then pulls back as the marble gathers speed.
    const blend=MarbleRun.ease(MarbleRun.clamp(step===3?(u-.1)*2.4:u*(step===8?6:2.7)));
    let cx,cy,width;
    if(closeUp){
      width=mobile?340:780;
      // While the marble is in the visitor's hand the camera stays put, or dragging would drag the picture along.
      cx=follow.x-(mobile?.04:.17)*width;
      cy=follow.y-(mobile?.16:.13)*width*rect.height/Math.max(1,rect.width);
      if(step&&carried){
        // Ease from the previous scene's framing into following the marble, in either direction.
        const enter=MarbleRun.ease(MarbleRun.clamp(u*3.5));
        cx=MarbleRun.mix(start[0],cx,enter);cy=MarbleRun.mix(start[1],cy,enter);width=start[2]*Math.pow(width/start[2],enter);
      }
    }else{
      cx=MarbleRun.mix(start[0],target[0],blend);cy=MarbleRun.mix(start[1],target[1],blend);
      width=start[2]*Math.pow(target[2]*(mobile?(step>=5?.86:.6):1)/start[2],blend);
    }

    if(step===3&&!reduced.matches){
      const k=(pose.breakage-MarbleRun.impact())/.07;
      if(k>0&&k<1)cy+=width*.006*(1-k)*Math.sin(k*19);
    }
    const height=width*rect.height/Math.max(1,rect.width);
    if(step===0){
      // Where the marble waits (its home, x -240), in page pixels. The rail climbs to the left by .055 per unit and its top
      // edge is about 16 units below the marble's centre, so it is set low enough to pass under the headline.
      // Computer: in the open space right of the copy. Phone: at the copy's right margin, the rail just under the headline.
      const head=app.querySelector('.welcome-copy h1').getBoundingClientRect(),copy=app.querySelector('.welcome-copy').getBoundingClientRect(),px=rect.width/width;
      let dockX,dockY;
      if(mobile){dockX=copy.right-rect.left-19*px;dockY=head.bottom-rect.top+22+.055*(dockX-head.left+rect.left)-16*px}
      else{dockX=copy.right-rect.left+(rect.width-copy.right+rect.left)*.42;dockY=head.bottom-rect.top+26+.055*(dockX-head.left+rect.left)-16*px}
      cx=-240-(dockX/rect.width-.5)*width;
      cy=(MarbleRun.ground(-240)-25)-(dockY/rect.height-.5)*height;
      // The Start button: above the marble on a computer, below the rail at the copy's right margin on a phone.
      const cta=app.querySelector('.cover-start'),w=cta.offsetWidth,h=cta.offsetHeight;
      cta.style.left=(mobile?copy.right-rect.left-w:dockX-w/2)+'px';
      cta.style.top=(mobile?dockY+19*px+34:dockY-19*px-24-h)+'px';
    }
    if(step===0){
      const button=app.querySelector('.marble-start');
      button.style.left=((-240-cx)/width+.5)*100+'%';
      button.style.setProperty('--roll-x',(pose.x+240)*rect.width/width+'px');
      button.style.setProperty('--roll-angle',pose.spin+'deg');
      nodes.get('traveller').style.visibility='hidden';
      button.style.top=((pose.y-cy)/height+.5)*100+'%';
      button.style.setProperty('--orb-size',38*rect.width/width+'px');
    }
    lastCamera=[cx,cy,width];
    // The picture itself jolts with the worry. Only the picture: lastCamera stays steady, or the marble would jitter under the finger.
    if(felt&&!reduced.matches){const now=performance.now()/1000,k=worryShake*width*felt*felt;cx+=.006*k*Math.sin(now*47);cy+=.009*k*Math.sin(now*61+1)}
    svg.setAttribute('viewBox',[cx-width/2,cy-height/2,width,height].join(' '));
  }
  if(step===0){
    let previous=0,elapsed=0;
    function roll(now){
      if(previous&&!document.hidden&&!state.paused)elapsed+=Math.min(80,now-previous);previous=now;
      // The waiting marble never quite rests: it rolls slowly to and fro on its rail, with a little extra sway.
      coverX=-240+15*Math.sin(elapsed/760)+3*Math.sin(elapsed/290);
      paint(0,0);if(!reduced.matches)raf=requestAnimationFrame(roll);
    }
    roll(performance.now());
    if(reduced.matches)document.fonts?.ready.then(()=>{if(rig?.stage===stage&&state.step===0)paint(0,0)});   // still marble: place it once the headline has its font
    return;
  }
  // No auto-advance: when the scene has played, Continue appears and the visitor clicks on.
  const section=stage.closest('section');
  const lead=hold/(duration+hold);
  animate(duration+hold,raw=>{
    // Scene 1 carries its own pace (MarbleRun.surge), so it runs on plain time: "Fast." and the push share one frame.
    const u=Math.max(0,(raw-lead)/(1-lead)),f=step===1?u:f0+(1-f0)*settle(u);
    if(step===1&&f>=MarbleRun.fastAt)section.querySelector('.late')?.classList.add('now');
    // "So am I." gives way to "What if…" a set stretch of the run before the burst, so the question is fully there
    // while the marble races at the break, and the burst answers it (style.css: .whatif-now).
    section.classList.toggle('whatif-now',step===3&&f>=whatIfAt);
    paint(f,u);
  },()=>{
    section.classList.add('ready');
    // "What about you?": when the marble has come to rest at the brink, "Are you worried?" follows on its own.
    if(step===2&&state.step===2){redraw=()=>paint(1,1);const held=section.querySelector('.headline:not(.leaving) .held:not(.shown)');if(held){held.classList.add('shown');askedAt=performance.now()}if(reduced.matches)redraw()}
    // The worried scene keeps shivering while it waits for the click.
    if(step===2&&!reduced.matches){const idle=()=>{if(!state.paused&&!document.hidden&&!sheet.open)paint(1,1);raf=requestAnimationFrame(idle)};raf=requestAnimationFrame(idle)}
  });
}
function welcome(){
  // No name here: it is asked for only when the jar is sent (play.js). The big round Start sits above the waiting marble
  // (beside the copy on a computer, under the rail on a phone: placed in machine()); the marble itself starts too.
  const start=W.start||U.start;
  app.innerHTML='<section class="welcome opening"><div class="illustration"></div><div class="welcome-copy"><button class="face" type="button" data-about aria-label="'+esc(A.open)+'"><img src="assets/mareike.jpg" alt="Mareike Jens"></button><h1>'+esc(W.title)+'<span>'+esc(W.subtitle)+'</span></h1><p class="visit-notice">'+esc(W.notice||'')+'</p></div>'+
    // How the click is invited: a "Click here" note under the run, pointing up at the marble (owner's pick, 26 Nov).
    // ?cta=text (big grey capitals) and ?cta=pill stay to compare.
    '<button class="cover-start" type="button" data-start>'+esc(start)+'</button><button class="marble-start" type="button" data-start aria-label="'+esc(start)+'"><span aria-hidden="true">'+esc(start)+'<svg viewBox="0 0 24 30"><path d="M6 2c9 4 12 13 9 25M10 22l5 6 4-7"/></svg></span></button></section>';
  app.querySelector('.welcome').classList.add('cta-'+({pill:'pill',text:'text'}[new URLSearchParams(location.search).get('cta')]||'tag'));
  machine(app.querySelector('.illustration'),0);
  for(const b of app.querySelectorAll('[data-start]'))b.onclick=()=>{
    const from=app.querySelector('.welcome-copy .face img').getBoundingClientRect();
    openerStart=coverX;Track.send('start');go(1,()=>dockPortrait(from));
  };
}
// The cover portrait travels up into the header corner while shrinking; the header fades in around it.
function dockPortrait(from){
  if(reduced.matches)return;
  const mast=document.querySelector('.mast'),img=mast.querySelector('.face img'),to=img.getBoundingClientRect();
  const timing={duration:950,easing:'cubic-bezier(.5,0,.15,1)',fill:'backwards'};
  const border=3*to.width/from.width;
  img.animate([
    {transformOrigin:'top left',transform:'translate('+(from.left-to.left)+'px,'+(from.top-to.top)+'px) scale('+from.width/to.width+')',boxShadow:'0 0 0 '+border+'px white, 0 3px 12px #6e553723'},
    {transformOrigin:'top left',transform:'none',boxShadow:'0 0 0 0 white, 0 3px 12px #6e553723'}
  ],timing);
  mast.animate([{backgroundColor:'transparent'},{}],timing);
  for(const el of mast.querySelectorAll('#siteTitle,.mast-tools'))el.animate([{opacity:0,translate:'-8px 0'},{opacity:1,translate:'0 0'}],{duration:450,delay:650,easing:'ease-out',fill:'backwards'});
}
// "Fill your marble jar" in the About card (about.bodyLink) is a link to the marble field, from wherever the card was opened.
function aboutBody(){
  const [before,after]=A.body.split(A.bodyLink||'\u0000');
  return after===undefined?esc(A.body):esc(before)+'<a href="#" data-goto-field>'+esc(A.bodyLink)+'</a>'+esc(after);
}
document.addEventListener('click',e=>{if(!e.target.closest('[data-goto-field]'))return;e.preventDefault();if(sheet.open)sheet.close();if(state.step!==12)go(12)});
function about(){
  const logos=[['kit.png','KIT',1.2],['ibm.svg','IBM',1],['bcg.png','BCG',1],['optiml.png','Optiml',1.15],['eth.png','ETH Zürich',.88]];
  openSheet('<div class="detail about"><img class="portrait" src="assets/mareike.jpg" alt=""><h2>'+esc(A.name)+'</h2><p>'+esc(A.lead)+'</p><p>'+aboutBody()+'</p><p class="small">'+esc(A.background)+'</p><ul class="logos" aria-label="'+esc(A.logosLabel)+'">'+logos.map(([file,name,h])=>'<li><img src="assets/logos/'+file+'" alt="'+name+'" style="height:'+h+'em"></li>').join('')+'</ul><p class="links"><a href="https://www.linkedin.com/in/mareike-jens/" target="_blank" rel="noopener">LinkedIn</a><a href="https://mareikejens.substack.com/" target="_blank" rel="noopener">Substack</a>'+(A.email?'<a href="mailto:'+esc(A.email)+'">'+esc(A.emailLabel)+'</a>':'')+(window.IDEA_MAP.send?.bookingUrl?'<a href="'+esc(window.IDEA_MAP.send.bookingUrl)+'" target="_blank" rel="noopener">'+esc(A.bookLabel)+'</a>':'')+'</p>'+legalLink()+'</div>');
}
document.addEventListener('click',e=>{if(e.target.closest('[data-about]'))about()});
// The privacy note has no footer of its own. It is a small link in two places: on the About card (reachable from every
// screen through the portrait) and under the form where a jar is sent. Its words are in content.js ("legal").
const L=window.IDEA_MAP.legal;
const legalLink=()=>L?.privacy?'<button type="button" class="legal-link" data-legal="privacy">'+esc(L.privacy.title)+'</button>':'';
document.addEventListener('click',e=>{
  const page=L?.[e.target.closest('[data-legal]')?.dataset.legal];if(!page)return;
  e.preventDefault();
  openSheet('<div class="detail legal-text"><h2>'+esc(page.title)+'</h2>'+page.sections.map(([head,text])=>(head?'<h3>'+esc(head)+'</h3>':'')+'<p>'+esc(text).replace(/\n/g,'<br>')+'</p>').join('')+'</div>');
});
function runWords(label){
  const mark=label.match(/\[([^\]]+)\]/);
  if(!mark)return esc(label);
  return esc(label.slice(0,mark.index))+'<strong class="beat">'+esc(mark[1])+'</strong>'+esc(label.slice(mark.index+mark[0].length));
}
// Body copy: words in [brackets] arrive a beat after the rest of the line.
function lateWords(text){
  const mark=text.match(/\[([^\]]+)\]/);
  if(!mark)return esc(text);
  return esc(text.slice(0,mark.index))+'<span class="late">'+esc(mark[1])+'</span>'+esc(text.slice(mark.index+mark[0].length));
}
// Steps: 0 cover, 1 to 11 the run (3 is the first problem, 6 "Because:", 7 to 11 the other five in the order of content.js, each at its own station), 12 the marble page, 13 the game.
function story(){
  const s=state.step,group=s===3?groups[0]:s>=7?groups[s-6]:null;
  // "What about you?" stands alone first; the next click asks the question itself (see go()).
  const worried=esc(S.worried)+' <span class="held">'+esc(S.worriedAsk)+'</span>';
  const title=group?runWords(group.runLabel):s===2?worried:esc([null,S.intro,null,null,S.even,S.transition,S.because][s]);
  const body=s===1?S.introBody:group?.question;
  const kind=group?'station':s<=2?'opening':'';
  // The first danger is posed as a question: "I am." stands alone while the marble races down the drop, "What if…" then takes its place, and the answer appears as the marble bursts.
  // "I am." answers the question from the scene before, then the first danger follows.
  const lead=s===3?'<span class="iam">'+esc(state.worried==='yes'||state.worried==='little'?S.iAmToo:state.worried==='no'?S.iAmBut:S.iAm)+'</span><span class="whatif">'+esc(S.whatIf)+'</span> ':'';
  const head='<h1 tabindex="-1" class="'+(s===2?'worry':'')+'">'+lead+(lead?'<span class="answer">'+title+'</span>':title)+'</h1>'+(body?'<p>'+lateWords(body)+'</p>':'')+
    (s===2?'<p class="answers"><b class="drag-level" aria-live="polite"></b></p>':'');
  let section=app.querySelector('.stage.machine');
  if(!section){
    // ‹ and ›, like on slides: the same as ←/→ (and › like a tap: on "Are you worried?" it waits for the marble, see go()).
    app.innerHTML='<section class="stage machine '+kind+'"><div class="headline">'+head+'</div><div class="illustration"></div>'+slideArrows()+controls(U.next)+'</section>';
    section=app.firstElementChild;
    bindWorry(section);
  }else{
    // Same stage, next scene: only the words change. The old line fades out, then the new one fades in.
    section.classList.remove('ready');
    const headline=section.querySelector('.headline');
    const swap=()=>{
      section.classList.toggle('station',kind==='station');section.classList.toggle('opening',kind==='opening');
      headline.innerHTML=head;headline.classList.remove('leaving');headline.querySelector('h1').focus({preventScroll:true});
    };
    if(reduced.matches)swap();else{headline.classList.add('leaving');headTimer=setTimeout(swap,200)}
  }
  machine(section.querySelector('.illustration'),s);
}
let headTimer=0;
// Dragging the marble on the "Are you worried?" scene. Pointer positions are turned into places on the rail through the camera.
function bindWorry(section){
  const stage=section.querySelector('.illustration');
  const active=()=>state.step===2&&section.classList.contains('ready')&&!!section.querySelector('.held.shown')&&lastCamera&&lastPose;
  const railX=e=>{const r=stage.getBoundingClientRect();return lastCamera[0]+((e.clientX-r.left)/r.width-.5)*lastCamera[2]};
  const say=()=>{
    const label=section.querySelector('.drag-level');if(!label||!worry)return;
    const level=worry.level=worryLevel(worry.x),k=level>=1?3:level>.66?2:level>.33?1:0;
    worry.answer=k>=2?'yes':k===1?'little':'no';label.textContent=S.worriedLevels[k];
    section.classList.add('dragging');
  };
  let track=null;
  section.addEventListener('pointerdown',e=>{
    if(!active()||e.target.closest('button,a'))return;
    // Only a press on the marble (generously measured, for thumbs) picks it up. A press anywhere else is still "continue".
    const r=stage.getBoundingClientRect(),px=r.width/lastCamera[2];
    const mx=r.left+((lastPose.x-lastCamera[0])/lastCamera[2]+.5)*r.width,my=r.top+r.height/2+(lastPose.y-lastCamera[1])*px;
    if(Math.hypot(e.clientX-mx,e.clientY-my)>Math.max(34,26*px))return;
    const x=worry?worry.x:lastPose.x;
    worry={x,v:0,dragging:true,released:false,anchor:worry?worry.anchor:{x:lastPose.x,y:lastPose.y},grab:railX(e)-x,last:performance.now()};
    track={x,t:performance.now(),moved:false};
    section.setPointerCapture?.(e.pointerId);say();
  });
  section.addEventListener('pointermove',e=>{
    if(!worry?.dragging||!track)return;
    const now=performance.now(),x=Math.max(MarbleRun.brink-worryBack,Math.min(MarbleRun.brink+30,railX(e)-worry.grab));
    // Remember how fast the hand was moving, so a flick throws the marble.
    if(now>track.t)worry.v=.6*worry.v+.4*(x-worry.x)/((now-track.t)/1000);
    if(Math.abs(x-track.x)>3)track.moved=true;
    worry.x=x;track.t=now;say();if(reduced.matches)redraw?.();
  });
  const drop=()=>{
    if(!worry?.dragging)return;
    worry.dragging=false;worry.released=true;worry.last=performance.now();
    worry.v=Math.max(-420,Math.min(520,performance.now()-track.t>90?0:worry.v));
    // The browser sends a click after the release. That click must not count as "continue".
    dragged=track.moved;setTimeout(()=>{dragged=false},0);
    if(reduced.matches){worry.x=MarbleRun.brink;worryStep(performance.now()+16)}
    track=null;
  };
  section.addEventListener('pointerup',drop);section.addEventListener('pointercancel',drop);
}
// The marble page: the screen fills with marbles, they part around a clearing, the sentence appears there and the question then replaces it.
// ?flood opens this page directly, for reviewing it without replaying the story.
function fillMarbleField(){
  const field=app.querySelector('.specimens');
  if(!field)return;
  const stage=field.parentNode;
  const {width:W,height:H}=field.getBoundingClientRect();
  // About 150 marbles whatever the screen: the marble grows with the screen instead of the count.
  const d=Math.min(72,Math.max(30,Math.sqrt(W*H/150)/1.21));
  const pitch=d*1.3,rowHeight=d*1.13;
  const columns=Math.ceil(W/pitch)+2,rows=Math.ceil(H/rowHeight)+2;
  let seed=2407;
  const random=n=>{seed=(seed*16807)%2147483647;return Math.floor(seed/2147483647*n)};
  const rnd=()=>random(10000)/10000;
  // Opening picture: a loose hand-laid field. A grid, with every marble nudged off its spot and sized a little differently.
  const slots=[],visible=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const r=d*(.4+rnd()*.2);
    const x=(col-.7+(row%2)*.5)*pitch+d/2+(rnd()-.5)*d*.3,y=(row-.4)*rowHeight+d/2+(rnd()-.5)*d*.3;
    if(x-r>=0&&x+r<=W&&y-r>20&&y+r<H-110)visible.push(slots.length);
    slots.push({x,y,r,g:random(groups.length),shade:random(6),tx:x,ty:y});
  }
  const shown=ideas.filter(i=>!i.own);
  const pool=visible.length>=shown.length?visible:slots.map((_,i)=>i);
  shown.forEach((idea,i)=>Object.assign(slots[pool[Math.floor((i+.5)*pool.length/shown.length)]],{idea,g:idea.g,shade:idea.shade}));
  // The field spreads out from the marble that rolled in from the run.
  const first=slots.find(m=>m.idea&&m.idea.id==='equity-1')||{x:W/2,y:H/2};
  const reach=Math.hypot(Math.max(first.x,W-first.x),Math.max(first.y,H-first.y));
  for(const m of slots)m.arrive=Math.hypot(m.x-first.x,m.y-first.y)/reach*650;

  {
    // Clearing: a rounded opening in the middle. Marbles inside are pushed to its rim, then everything shuffles until nobody overlaps much.
    const cx=W/2,cy=H*.43,rx=Math.min(W<700?W*.39:W*.27,330),ry=Math.min(Math.max(H*(W<700?.125:.15),92),150);   // tighter around the short question (owner, 26 Nov)
    const norm=(x,y)=>(Math.abs((x-cx)/rx)**2.5+Math.abs((y-cy)/ry)**2.5)**.4;
    const clear=m=>{
      const need=1+m.r/ry*.55,n=norm(m.tx,m.ty);
      if(n>=need)return;
      if(n<.02){m.tx=cx+(rnd()-.5)*8;m.ty=cy+(rnd()<.5?-4:4);return clear(m)}
      m.tx=cx+(m.tx-cx)*need/n;m.ty=cy+(m.ty-cy)*need/n;
    };
    for(let pass=0;pass<45;pass++){
      slots.forEach(clear);
      for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++){
        const p=slots[i],q=slots[j],dx=q.tx-p.tx,dy=q.ty-p.ty,gap=(p.r+q.r)*1.04,dist=Math.hypot(dx,dy)||.01;
        if(dist>=gap)continue;
        const push=(gap-dist)/2/dist;
        p.tx-=dx*push;p.ty-=dy*push;q.tx+=dx*push;q.ty+=dy*push;
      }
    }
    slots.forEach(clear);
    for(const m of slots){m.delay=Math.min(1,Math.max(0,norm(m.x,m.y)-.2))*160;m.time=900}
    for(const [k,v] of Object.entries({cx,cy,rx,ry}))stage.style.setProperty('--'+k,v+'px');
  }
  field.innerHTML=slots.map(m=>{
    const vars={left:m.x-m.r,top:m.y-m.r,width:m.r*2,'--dx':m.tx-m.x,'--dy':m.ty-m.y};
    const times={'--in':m.arrive,'--delay':m.delay,'--time':m.time};
    const drift='--ax:'+((rnd()-.5)*d*.26).toFixed(1)+'px;--ay:'+((rnd()-.5)*d*.26).toFixed(1)+'px;--beat:'+(6+rnd()*6).toFixed(1)+'s;--phase:-'+(rnd()*12).toFixed(1)+'s';
    return '<span class="specimen" '+(m.idea?'data-seed="'+esc(m.idea.id)+'"':'')+' style="'+
      Object.entries(vars).map(([k,v])=>k+':'+v.toFixed(1)+'px').join(';')+';'+Object.entries(times).map(([k,v])=>k+':'+Math.round(v)+'ms').join(';')+';'+drift+
      '"><img alt="" src="'+marbleImage(m.g,m.shade)+'"></span>';
  }).join('');
}
function flood(origin){
  app.innerHTML='<section class="world"><div class="flood"><div class="specimens" aria-hidden="true"></div><div class="clearing" aria-hidden="true"></div><div class="covercopy"><h1 tabindex="-1">'+esc(S.swarm)+'</h1><p>'+esc(S.swarmBody)+'</p></div>'+slideArrows()+'</div>'+controls(U.sort)+'</section>';
  fillMarbleField();
  const world=app.firstElementChild,stage=world.firstElementChild;
  // Four beats, each one a tap (see go()): the screen is full of marbles; a tap and they make room and the sentence arrives; a tap and the question
  // takes its place; a tap and the game opens. With reduced motion everything is shown at once.
  cancelAnimationFrame(raf);
  if(reduced.matches){stage.classList.add('settled','asked');world.classList.add('ready')}
  if(origin&&!reduced.matches){
    const seed=app.querySelector('[data-seed="thinking-1"]');   // a blue one, like the marble of the run
    const img=seed?.querySelector('img'),dest=seed?.getBoundingClientRect();
    if(img&&dest)img.animate([
      {transformOrigin:'top left',transform:'translate('+(origin.left-dest.left)+'px,'+(origin.top-dest.top)+'px) scale('+origin.width/dest.width+')'},
      {transformOrigin:'top left',transform:'none'}
    ],{duration:700,easing:'cubic-bezier(.22,.68,.2,1)'});
  }
}
window.addEventListener('resize',()=>{if(state.step===12)fillMarbleField()});
// Marble field → game. The field is lifted off the page onto a layer above it and the game is built underneath. Then the marbles of the
// problem the game opens on fly to their places on its shelves, every other marble parts outward and fades, and the game fades in.
let veil=null,veilTimer=0;
function endHandover(){
  clearTimeout(veilTimer);veil?.remove();veil=null;
  for(const el of app.querySelectorAll('.arriving,.incoming'))el.classList.remove('arriving','incoming');
}
function handover(swap){
  const world=app.firstElementChild,box=world.getBoundingClientRect();
  veil=document.createElement('div');veil.className='handover';
  world.style.cssText='position:absolute;margin:0;min-height:0;left:'+box.left+'px;top:'+box.top+'px;width:'+box.width+'px;height:'+box.height+'px';
  veil.append(world);document.body.append(veil);
  // Where every marble is right now (measuring also makes the browser settle the moved layer, so the moves below animate).
  const marbles=[...world.querySelectorAll('.specimen')].map(el=>({el,box:el.getBoundingClientRect(),at:new DOMMatrix(getComputedStyle(el).transform)}));
  veil.classList.add('going');swap();
  const game=app.firstElementChild;game.classList.add('arriving');
  const cx=box.left+box.width/2,cy=box.top+box.height*.43,far=Math.hypot(box.width,box.height)*.7;
  let landing=0,last=0;
  for(const {el,box:b,at} of marbles){
    const x=b.left+b.width/2,y=b.top+b.height/2;
    const pick=el.dataset.seed&&[...game.querySelectorAll('.pick:not(.selected)')].find(p=>p.dataset.id===el.dataset.seed);
    if(pick){
      const slot=pick.querySelector('.ball').getBoundingClientRect(),delay=180+landing++*70;
      pick.classList.add('incoming');last=Math.max(last,delay+900);
      el.style.zIndex=2;
      el.style.transition='transform .9s cubic-bezier(.3,.1,.15,1) '+delay+'ms';
      el.style.transform='translate('+(at.e+slot.left+slot.width/2-x)+'px,'+(at.f+slot.top+slot.height/2-y)+'px) scale('+slot.width/b.width+')';
    }else{
      const reach=Math.hypot(x-cx,y-cy)||1,delay=Math.min(1,reach/far)*120;
      el.style.transition='transform .85s cubic-bezier(.5,0,.8,.45) '+delay+'ms,opacity .45s ease '+(delay+280)+'ms';
      el.style.transform='translate('+(at.e+(x-cx)/reach*far)+'px,'+(at.f+(y-cy)/reach*far)+'px)';
      el.style.opacity=0;
    }
  }
  // Landed: the real shelf marbles fade in under the flown ones, then the layer is taken away.
  veilTimer=setTimeout(()=>{
    for(const el of game.querySelectorAll('.incoming'))el.classList.remove('incoming');
    veilTimer=setTimeout(endHandover,400);
  },Math.max(last,950));
}
let booted=false;
function go(n,after){
  const from=state.step;
  const source=from===11&&n===12?app.querySelector('#mate2 image'):null;
  const handoff=source?source.getBoundingClientRect():null;
  n=Math.max(0,Math.min(13,n));
  // Marble page: the first tap parts the marbles and brings the sentence, the second brings the question, the third moves on.
  const asking=from===12&&n>12&&app.querySelector('.flood:not(.asked)');
  if(asking){
    cancelAnimationFrame(raf);
    if(!asking.classList.contains('settled'))asking.classList.add('settled');
    else{asking.classList.add('asked');asking.parentNode.classList.add('ready')}
    return;
  }
  // "Are you worried?": the first click on that scene brings the question, the next one moves on.
  const held=from===2&&n>2&&app.querySelector('.headline:not(.leaving) .held:not(.shown)');
  if(held){held.classList.add('shown');askedAt=performance.now();if(reduced.matches)redraw?.();return}
  // "Are you worried?" is answered with the marble, and a tap anywhere does not move on: the marble hops instead
  // (a visual cue only: no written hints on this site), every time. Keyboard, the hidden Continue button and Skip
  // still pass (goPass), so nobody who cannot drag is stuck.
  const pass=goPass;goPass=false;
  if(from===2&&n>2&&!pass&&!worry?.done&&app.querySelector('.held.shown')){
    if(!reduced.matches)nudgedAt=performance.now();
    return;
  }
  state.step=n;state.paused=false;cancelAnimationFrame(raf);clearTimeout(headTimer);
  const swap=()=>{
    if(from===13)Play.unmount();
    window.scrollTo(0,0);
    if(!n)lastCamera=null;
    document.body.classList.toggle('cover',!n);   // the header only exists once the run has started
    if(!n)welcome();else if(n<=11)story();else if(n===12)flood(handoff);else Play.mount();
    app.querySelector('h1[tabindex]')?.focus({preventScroll:true});
    if(after)after();
  };
  // Scenes of the run share one stage and animate themselves. Every other change of screen is a
  // different page, so the browser cross-fades a snapshot of the old one into the new one.
  const sameStage=from>=1&&from<=11&&n>=1&&n<=11&&app.querySelector('.stage.machine');
  endHandover();
  if(from===12&&n===13&&booted&&!reduced.matches&&app.querySelector('.specimen'))handover(swap);
  // Cover → story: no cross-fade of the whole page. The portrait flies up on its own (dockPortrait), and a cross-fade
  // would also keep a second copy of it fading out in place. Only the new screen fades in.
  else if(from===0&&n===1&&booted&&!reduced.matches){swap();app.animate([{opacity:0},{opacity:1}],{duration:450,easing:'ease'})}
  else if(!booted||sameStage||reduced.matches||!document.startViewTransition)swap();
  else document.startViewTransition(swap);
  booted=true;
}
function openSheet(html){detail.innerHTML=html;const x=sheet.querySelector('.x');x.textContent='×';x.setAttribute('aria-label',U.close);if(!sheet.open)sheet.showModal();sheet.scrollTop=0}
function cardSections(idea){
  const fields=[['vision','Vision'],['why','Why'],['question','Let’s discuss']];
  const clean=key=>idea[key].replace(/\s*\((?:draft|guess)(?::[^)]*)?\)\s*$/,'');
  // The scene is a picture: assets/scenes/<idea id>.jpg. Its words stay as the alt text for screen readers.
  // If the picture is missing, the figure marks itself "missing" and the stylesheet shows the words instead.
  const scene='<figure class="card-scene"><img src="assets/scenes/'+esc(idea.id)+'.jpg" alt="'+esc(clean('scene'))+'" onerror="this.parentNode.classList.add(\'missing\')">'+
    '<figcaption><b>Scene</b>'+esc(clean('scene'))+'</figcaption></figure>';
  return scene+'<dl class="card-sections">'+fields.map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(clean(key))+'</dd>').join('')+'</dl>';
}
sheet.querySelector('.x').onclick=()=>sheet.close();
sheet.addEventListener('click',e=>{if(e.target===sheet){const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)sheet.close()}});
app.onclick=e=>{
  if(dragged){dragged=false;return}
  const b=e.target.closest('button');
  if(!b){
    if(state.step>=1&&state.step<=12&&!e.target.closest('a,input,textarea,select,form,dialog')&&!window.getSelection()?.toString())go(state.step+1);
    return;
  }
  switch(b.dataset.action){
    case'next':goPass=true;go(state.step+1);break;
    case'forward':goPass=e.detail===0;go(state.step+1);break;   // a click is a tap; Enter or Space on the arrow is the keyboard
    case'back':go(state.step-1);break;
    case'restart':go(0);break;
    case'skip':
      // Straight to the marble page (all the marbles, full screen). "Are you worried?" holds back its question and
      // waits for the marble: mark the question shown and pass, so the jump is not caught there.
      app.querySelector('.held')?.classList.add('shown');goPass=true;
      go(12);break;
  }
};
document.querySelector('.mast').onclick=e=>{if(!e.target.closest('button,a')&&state.step>=1&&state.step<=12&&!sheet.open)go(state.step+1)};
document.addEventListener('keydown',e=>{
  if(state.step<1||state.step>12||sheet.open||e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,textarea,select'))return;
  // → / Enter / Space: on; ←: back (not from the first scene, where back would leave the story for the cover).
  // Enter and Space belong to a focused button or link; the arrows work wherever the focus is (also on ‹ › after a click).
  const control=e.target.closest('button,a');
  if(e.key==='ArrowRight'||!control&&(e.key==='Enter'||e.key===' ')){e.preventDefault();goPass=true;go(state.step+1)}
  else if(e.key==='ArrowLeft'&&state.step>1){e.preventDefault();go(state.step-1)}
});
// ?skip jumps straight to the game, for reviewing it without replaying the story.
// A visitor who already reached the ideas in this tab lands there again after a reload, instead of at the welcome screen.
let reached=false;try{reached=sessionStorage.getItem('idea-map-reached')==='yes'}catch{}
go(new URLSearchParams(location.search).has('skip')||reached?13:new URLSearchParams(location.search).has('flood')?12:0);
