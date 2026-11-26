// All distances are in the same world coordinates as the rail and the glass ball.
const MarbleRun = (() => {
  const clamp = (x,lo=0,hi=1) => Math.max(lo,Math.min(hi,x));
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = t => t*t*(3-2*t);
  const rad = Math.PI/180;
  const radius = 19;
  const ends = [-115,150,550,710,1430,1750,2050,2230];
  // The opening never climbs. The marble starts high on a calm slope and creeps to the brink while the worry
  // builds. The acceleration belongs to the collapse scene: there it tips over the brink, plunges ever faster,
  // and the run gives way as it arrives.
  // The drop is tall and short: about 50° at its steepest, so the marble visibly races rather than rolls.
  const plungeHeight=150, plungeFrom=352, plungeTo=548, brink=345;
  // Scene 3 spends its first quarter on the plunge (about 0.7s); the break clock then starts just before the run lets go.
  const fall={start:.26,from:.22};
  const plunge = x => {const u=clamp((x-plungeFrom)/(plungeTo-plungeFrom));return u*u*(3-2*u)};
  const base = x => 148+.055*x
    - plungeHeight*(1-plunge(x))
    + (x>=1480?58:0)
    - .055*Math.max(0,x-1630);
  // The misuse station is part of the track, between the break and the bridge: the rail dives down a steep ramp almost
  // to the floor and ends in an upturned lip (a quarter pipe), which throws the marble over a gap onto the next rail.
  // Everything after it (bridge, gate, gap, seesaw) stands `rampSpan` further right than the plain line would put it.
  const kickTop=712,kickLow=902,kickEnd=959,kickDrop=131,lipRadius=62,rampSpan=420,landFrom=1040;
  const kicker = x => {
    const u=clamp((x-kickTop)/(kickLow-kickTop)),low=base(kickTop)+kickDrop;
    if(x<kickLow)return low-kickDrop*(1-u*u*(3-2*u));
    const lip=y=>low-lipRadius+Math.sqrt(lipRadius**2-(y-kickLow)**2);
    // Past its end the lip is carried on straight, so the slope at the very end can still be measured.
    return x<=kickEnd?lip(x):lip(kickEnd)+(x-kickEnd)*(lip(kickEnd)-lip(kickEnd-1));
  };
  const ground = x => x<=kickTop?base(x):x<kickEnd+3?kicker(x):base(Math.max(kickTop,x-rampSpan));
  // Step 6 ("Because:") has no station: the camera and the marble stay where scene 5 left them.
  const camera = {1:[45,143,680],2:[348,155,720],3:[730,248,1120],4:[730,248,1120],
    5:[650,222,740],6:[650,222,740],7:[950,228,700],8:[1280,215,492],9:[1582,250,680],10:[1900,267,535],11:[2183,305,680]};
  const times = {1:2500,2:2200,3:1450,4:1500,5:1500,6:1500,7:4800,8:4400,9:2800,10:2200,11:3800};
  function railPath(a,b,ground){
    const points=[];
    for(let x=a;x<b;x+=4)points.push([x,ground(x)]);
    points.push([b,ground(b)]);
    return points.map(([x,y],i)=>(i?'L':'M')+x+' '+y.toFixed(2)).join(' ');
  }
  function rail(a,b,line=ground){
    const d=railPath(a,b,line);
    // The same concave ceramic profile is used on every section and moving leaf.
    const layers=[[9,15,'#d4c3ae'],[6,19,'#e3d5c2'],[2,20,'#fcf7ef'],[-2,14,'#e0d3c3'],[-4,9,'#ede3d5'],[-5,3,'#fffaf3'],[5,3,'#fffdf7']];
    return '<g fill="none" stroke-linecap="round" stroke-linejoin="round">'+layers.map(([dy,w,c])=>'<path d="'+d+'" transform="translate(0 '+dy+')" stroke="'+c+'" stroke-width="'+w+'"/>').join('')+'</g>';

  }
  const foot=(x,line=ground)=>'<ellipse cx="'+(x+3)+'" cy="342" rx="29" ry="4" fill="url(#shadow)"/><rect x="'+(x-5)+'" y="'+line(x)+'" width="10" height="'+(341-line(x))+'" rx="4" fill="url(#ash)"/>';
  const balanceX=2230,gateX=1589,gateY=ground(gateX)-81;
  const balanceY=ground(balanceX);
  const westBank=1185,eastBank=1375,bridgeCentre=(westBank+eastBank)/2;
  function leaf(id,bank,tip){
    const y=ground(bank),end=ground(tip);
    const brace='<path d="M'+bank+' '+(y+25)+' L'+tip+' '+(end+6)+' L'+bank+' '+(y+5)+'Z" fill="#d4b895"/>';
    return '<g id="'+id+'">'+brace+rail(Math.min(bank,tip),Math.max(bank,tip))+'</g>'+
      '<circle cx="'+bank+'" cy="'+y+'" r="6" fill="#c1a17f"/><circle cx="'+bank+'" cy="'+y+'" r="2" fill="#f4e6d4"/>';
  }
  // Worry, before anything breaks: hairline cracks run across the glazed rail where the marble is heading.
  // Each crack is one path that is drawn in from the top lip downwards (see app.js).
  const crackSites=[212,258,300,345,398,452,520,578];
  function crack(x,i){
    let seed=x*7+13;const rand=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5};
    const top=ground(x)-6;let px=x,d='M'+x+' '+top.toFixed(1),branch='';
    for(let k=1;k<=5;k++){
      px+=rand()*9;const at=px.toFixed(1)+' '+(top+k*4.3).toFixed(1);d+=' L'+at;
      if(k===2+i%2)branch=' M'+at+' l'+(rand()>0?7:-7)+' '+(3+rand()*3).toFixed(1)+' l'+(rand()*6).toFixed(1)+' 4';
    }
    return '<path class="crack" data-x="'+x+'" d="'+d+branch+'" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" opacity="0" fill="none" stroke="#7d6a55" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  const cracks=(a,b)=>crackSites.map((x,i)=>x>a&&x<b?crack(x,i):'').join('');
  // The run shivers in gusts rather than buzzing: a slow swell over two fast, slightly different wobbles per section.
  function quake(i,phase,tremor){
    const a=tremor*(.3+.7*Math.max(0,Math.sin(phase*1.9+i*.4))**2);
    return [.5*a*Math.sin(phase*61+i*2.1),1.3*a*Math.sin(phase*74+i*1.3)];
  }
  const sections=[
    foot(-490)+foot(-190)+foot(12)+foot(344)+rail(-1100,548)+cracks(-1100,548),
    foot(609)+rail(551,708)+cracks(551,708),
    foot(730)+foot(kickLow)+foot(948)+rail(kickTop,kickEnd),
    foot(1062)+foot(westBank)+foot(eastBank)+rail(landFrom,westBank)+rail(eastBank,1427)+leaf('bridgeLeft',westBank,bridgeCentre-1)+leaf('bridgeRight',eastBank,bridgeCentre+1),
    foot(1490)+foot(1700)+rail(1432,1748)+'<path d="M'+(gateX-7)+' '+(ground(gateX)+1)+' V'+gateY+'" stroke="#e1d1bc" stroke-width="8" stroke-linecap="round"/><g id="gate"><rect x="'+(gateX-4)+'" y="'+gateY+'" width="8" height="69" rx="4" fill="url(#ash)"/></g><circle cx="'+gateX+'" cy="'+gateY+'" r="5" fill="#c6a786"/>',
    foot(1783)+foot(1844)+rail(1752,1861)+foot(1916)+foot(2003)+rail(1900,2048),
    '<ellipse cx="2230" cy="341" rx="46" ry="5" fill="url(#shadow)"/><path d="M2201 340 L2225 '+(balanceY+12)+' Q2230 '+(balanceY+2)+' 2235 '+(balanceY+12)+' L2259 340Z" fill="url(#ash)"/><g id="balance">'+rail(2052,2408)+'<rect x="2405" y="'+(ground(2408)-34)+'" width="8" height="40" rx="4" fill="url(#ash)"/><circle cx="2230" cy="'+(balanceY+6)+'" r="4" fill="#ae967a"/></g>'

  ];
  // There is one blue marble in the story and only ever one in the picture. At misuse it is thrown off the run for good, so
  // at the bridge a fresh one is fed in from above (mate3), and at each station after that (thinking, work, equity) the same
  // blue marble is fed in again and gets stuck there: the run does not solve the problem for it. These are its four
  // stand-ins. Each is only visible during its own scene.
  const mateCount=4;
  const mateArt=()=>Array.from({length:mateCount},(_,i)=>'<ellipse id="mateShadow'+i+'" rx="23" ry="4" fill="url(#shadow)"/>').join('')+
    Array.from({length:mateCount},(_,i)=>'<g id="mate'+i+'" style="opacity:0"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38" clip-path="url(#orb)"/></g>').join('');
  function art(){
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    return '<defs><linearGradient id="ash"><stop stop-color="#cdb292"/><stop offset=".4" stop-color="#eddcc5"/><stop offset="1" stop-color="#d3b99a"/></linearGradient><radialGradient id="shadow"><stop stop-color="#77664e" stop-opacity=".27"/><stop offset="1" stop-color="#77664e" stop-opacity="0"/></radialGradient><g id="glass-at-impact"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38"/></g><clipPath id="orb"><circle r="19"/></clipPath></defs>'+
      sections.map((s,i)=>'<g id="part'+i+'">'+s+'</g>').join('')+
      mateArt()+'<circle id="halo" r="19" fill="none" stroke="#a32b36" stroke-width="1.4" opacity="0" vector-effect="non-scaling-stroke"/><g id="dragcue" opacity="0" fill="none" stroke="#292928" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path id="cueL" vector-effect="non-scaling-stroke" d="M-29 -6.5-35.5 0-29 6.5M-37 -5-42 0-37 5"/><path id="cueR" vector-effect="non-scaling-stroke" d="M29 -6.5 35.5 0 29 6.5M37 -5 42 0 37 5"/></g><ellipse id="contact" rx="23" ry="4" fill="url(#shadow)"/><g id="traveller"><image href="assets/run-glass.webp" x="-19" y="-19" width="38" height="38" clip-path="url(#orb)"/></g>'+
      explosion.art();
  }
  // Integrate travel time along the dipped rail from gravitational potential.
  function timedRail(a,b,push=125){
    let time=0;const points=[[0,a]],initial=ground(a);
    for(let x=a+1;x<=b;x++){
      const dy=ground(x)-ground(x-1);
      time+=Math.hypot(1,dy)/Math.sqrt(push**2+2*410*Math.max(-10,ground(x)-initial));
      points.push([time,x]);
    }
    return f=>{const t=f*time;let lo=0,hi=points.length-1;
      while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid][0]<t)lo=mid;else hi=mid}
      return mix(points[lo][1],points[hi][1],(t-points[lo][0])/(points[hi][0]-points[lo][0]));
    };
  }
  // On a steep rail the marble sits along the rail's normal, not straight above it.
  function ride(x,line=ground){
    const slope=(line(x+1)-line(x-1))/2,n=Math.hypot(1,slope);
    return {x:x+(radius+6)*slope/n,y:line(x)-(radius+6)/n};
  }
  const approach=668,waitingX=westBank-radius-5,gateStop=gateX-radius-4,lipStop=2405-radius;
  // A marble fed in from above: how far over its resting place it still is. It falls, lands, and hops once.
  function dropIn(t,from,to){
    const u=clamp((t-from)/(to-from));
    if(u<.7)return 340*(1-(u/.7)**2);
    const v=(u-.7)/.3;return 44*v*(1-v);
  }
  // Equity, where the marble is on the seesaw over the scene: lands right of the middle, slows to a stop just past it
  // on the left (2192, the middle is 2230), turns back, gathers speed down to the right end and knocks against the lip.
  const equityTurn=2192,equityLanded=.42,equityDown=.74;
  function equityX(t){
    if(t<.2)return 2270;
    if(t<equityLanded)return mix(2270,equityTurn,1-(1-(t-.2)/(equityLanded-.2))**2);
    if(t<equityDown)return mix(equityTurn,lipStop,clamp((t-equityLanded-.04)/(equityDown-equityLanded-.04))**1.8);
    if(t<equityDown+.1)return mix(lipStop,lipStop-13,1-(1-(t-equityDown)/.1)**2);
    return mix(lipStop-13,lipStop,clamp((t-equityDown-.1)/.12)**2);
  }
  // Where the stand-ins are (steps 8 to 11). Outside its own scene a stand-in is not shown (app.js fades it), so the
  // marble is always in exactly one place.
  function mates(step,t,balance){
    const rest=x=>ground(x)-radius-6,list=[];
    const put=(m,x)=>list.push({scale:1,air:false,spin:x/radius/rad,x,...m});
    {
      // Thinking: appears on the far side of the bridge, rolls into the gate, is thrown back, tries once more and stays there.
      let x=gateStop,up=0,show=0;
      if(step===9){
        show=clamp(t/.05);up=dropIn(t,0,.2);
        if(t<.5)x=mix(1460,gateStop,clamp((t-.2)/.3)**1.6);
        else if(t<.66)x=mix(gateStop,gateStop-26,1-(1-(t-.5)/.16)**2);
        else x=mix(gateStop-26,gateStop,clamp((t-.66)/.2)**2);
      }
      put({y:rest(x)-up,show,air:up>3},x);
    }
    {
      // Work: rolls off the end of its rail, misses the next one and ends up on the floor, out of the run.
      const edge=1864,land=1890,end=1907,lying=341-radius*1.12;
      let x=end,y=lying,scale=1.12,air=false,show=0;
      if(step===10){
        show=clamp(t/.05);
        if(t<.52){x=mix(1772,edge,clamp((t-.2)/.32)**1.6);const up=dropIn(t,0,.2);y=rest(x)-up;scale=1;air=up>3}
        else if(t<.72){const v=(t-.52)/.2;x=mix(edge,land,v);y=mix(rest(edge),lying,v*v);scale=mix(1,1.12,v);air=true}
        else{const v=(t-.72)/.28,hop=Math.min(1,v/.35);x=mix(land,end,1-(1-v)**2);y=lying-40*hop*(1-hop)}
      }
      put({y,show,air,scale},x);
    }
    {
      // Equity: lands on the seesaw, rolls left a little past the middle so it nearly balances, then turns back,
      // rolls down to the right end and stays there. The seesaw follows it (see equityX and balance in pose).
      let x=lipStop,up=0,show=0;
      if(step===11){show=clamp(t/.05);up=dropIn(t,0,.18);x=equityX(t)}
      put({y:balanceY+(x-balanceX)*Math.tan(balance*rad)-(radius+6)/Math.cos(balance*rad)-up,show,air:up>3},x);
    }
    {
      // Connection: the marble of the run is gone, so a fresh one drops onto the rail behind the bridge, hops,
      // and rolls up to the open bridge, where the old one used to wait.
      let x=waitingX,up=0,show=0;
      if(step===8){show=clamp(t/.05);up=dropIn(t,0,.17);x=mix(dropX,waitingX,1-(1-clamp((t-.17)/.15))**2)}
      put({y:rest(x)-up,show,air:up>3},x);
    }
    return list;
  }
  // Scene 1: the marble ambles for the first part, then the word "Fast." lands and it takes off.
  // `fastAt` is the place in the scene where that happens (app.js shows the word at the same moment).
  // The pace, as speed over time: a steady amble (it was already rolling on the cover), then at fastAt a short, visible
  // push up to top speed (kick), a fast run, and a brief brake at the very end. app.js runs this scene on plain time
  // (no settle), so the push lands on the same frame as the word.
  // (fastAt .52 of 4.8s: "Fast." lands about 2.5s in, so there is time to see the marble rolling before it does.)
  const fastAt=.52,amble=.15,kick=.064,brake=.11;
  const slow=amble/fastAt,top=(1-amble-kick*slow/2)/(kick/2+(1-fastAt-kick-brake)+brake/2);
  const surge=t=>{
    if(t<=fastAt)return slow*t;
    const k=t-fastAt;
    if(k<=kick)return amble+slow*k+(top-slow)*k*k/(2*kick);
    const kicked=amble+(slow+top)*kick/2,cruiseEnd=1-brake;
    if(t<=cruiseEnd)return kicked+top*(t-fastAt-kick);
    const b=Math.min(brake,t-cruiseEnd);
    return kicked+top*(cruiseEnd-fastAt-kick)+top*b-top*b*b/(2*brake);
  };
  let plungeRun=null,rampRun=null;
  // Misuse, the marble over the scene: it rolls off the mended rail onto the ramp, races down it ever faster, is thrown
  // up by the lip (launchAt) and shoots off to the top right, out of the picture for good (gone by exitAt). It does not
  // come back: the bridge scene gets a fresh marble (mate3, dropped in at dropX).
  const launchAt=.36,exitAt=.86,dropX=1128;   // scene 7 lasts 4.8s: the same ride down as before (1.7s), then a slow 2.4s flight out (owner, 26 Nov)
  function exitPath(v){
    // One curve from the lip: it leaves along the lip (almost straight up), then bends away to the right, speeding up.
    const p0=ride(kickEnd),k=ground(kickEnd)-ground(kickEnd-1),n=Math.hypot(1,k),w=v**1.35;
    const p1={x:p0.x+300/n,y:p0.y+300*k/n},p2={x:p0.x+1200,y:p0.y-1600};
    return {x:(1-w)**2*p0.x+2*(1-w)*w*p1.x+w*w*p2.x,y:(1-w)**2*p0.y+2*(1-w)*w*p1.y+w*w*p2.y};
  }
  function rampRide(t){
    if(t<launchAt){rampRun=rampRun||timedRail(approach,kickEnd,90);return {...ride(rampRun(t/launchAt)),airborne:false}}
    return {...exitPath(clamp((t-launchAt)/(exitAt-launchAt))),airborne:true};
  }
  function pose(step,f){
    const t=clamp(f);
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    const breaking=step===3||step===4;
    const plunging=step===3&&t<fall.start;
    const breakage=step===3?(plunging?0:mix(fall.from,1,(t-fall.start)/(1-fall.start))):step===4?1-t:0;
    let x=550;
    if(step===1)x=mix(ends[0],ends[1],surge(t));
    else if(step===2)x=mix(150,brink,t);
    // After the break is mended the marble rolls on towards the bridge. The bridge is as far as it gets.
    else if(step===5)x=mix(550,approach,t);
    else if(step===6)x=approach;
    // The two banks reach for each other, strain, and fall back open.
    let bridge=0;
    // (A little later than the drop-in of the fresh marble, which reaches the bridge at .32.)
    if(step===8){
      const rise=ease(clamp((t-.32)/.24)),give=ease(clamp((t-.68)/.12));
      bridge=.62*rise*(1-give)+.014*Math.sin(t*250)*clamp((t-.46)/.1)*(1-give)-.06*Math.sin(Math.PI*clamp((t-.8)/.16));
    }
    // The gate only shudders when the marble runs into it, twice, a little less the second time.
    const gate=step===9?-7*Math.sin(Math.PI*clamp((t-.5)/.12))-2.5*Math.sin(Math.PI*clamp((t-.86)/.08)):0;
    // The seesaw follows the one marble: level until it lands, dips a little to the left while the marble is past the
    // middle, then tips right as it rolls down and stays down (10°), with a small thud when its end meets the floor.
    let balance=0;
    if(step===11){
      const off=equityX(t)-balanceX,landed=ease(clamp((t-.16)/.1));
      balance=landed*(off<0?1.8*off/(balanceX-2052)*10:Math.min(10,10*off/(lipStop-balanceX)))-.9*Math.sin(Math.PI*clamp((t-equityDown)/.1));
    }
    let y=ground(x)-radius-6;
    if(step===2)({x,y}=ride(x));
    let airborne=false;
    if(step===7)({x,y,airborne}=rampRide(t));
    // From the bridge on, the marble of the run is gone: it stays where it left the picture (and is not shown).
    else if(step>7)({x,y,airborne}={...exitPath(1),airborne:true});
    if(plunging){
      // Gravity sets the pace: slow over the brink, fastest at the bottom, straight into the break.
      plungeRun=plungeRun||timedRail(brink,550+13*fall.from/explosion.onset,45);
      ({x,y}=ride(plungeRun(t/fall.start)));
    }else if(breaking)({x,y}=explosion.ball(breakage,y));
    const stressReached=(step===3&&breakage>=explosion.impact)||(step===7&&t>=launchAt)||(step===8&&t>=.7)||
      (step===9&&t>=.5)||(step===10&&t>=.52)||(step===11&&t>=equityDown);
    // tremor: how hard the run shakes (0 to 1). front: cracks left of this x have appeared. left: the marble of the run is
    // not shown any more; gone: it is out of the picture (also at the end of misuse), so going back it does not fly back in.
    const tremor=step===2?ease(clamp((t-.2)/.5)):step===3?1-clamp(t/(fall.start*.5)):0;
    const front=step===2?mix(150,brink,t)+130:step===3?brink+130+2500*t:step===4?mix(660,250,t):-1e4;
    return {tremor,front,stressReached,x,y,spin:(x-ends[0])/radius/rad,breakage,bridge,gate,balance,airborne,left:step>7,gone:step>7||step===7&&t>=exitAt,mates:mates(step,t,balance)};
  }
  function transforms(p){
    const explosion=typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion;
    const out=explosion.transforms(p);
    const lift=62*(1-p.bridge);
    out.bridgeLeft='rotate('+(-lift)+' '+westBank+' '+ground(westBank)+')';
    out.bridgeRight='rotate('+lift+' '+eastBank+' '+ground(eastBank)+')';
    out.gate='rotate('+p.gate+' '+gateX+' '+gateY+')';
    if(p.tremor)for(let i=0;i<sections.length;i++){
      const [dx,dy]=quake(i,p.phase||0,p.tremor);
      out['part'+i]='translate('+dx.toFixed(2)+' '+dy.toFixed(2)+') '+out['part'+i];
    }
    out.balance='rotate('+p.balance+' '+balanceX+' '+balanceY+')';
    p.mates.forEach((m,i)=>{
      out['mate'+i]='translate('+m.x.toFixed(2)+' '+m.y.toFixed(2)+') rotate('+m.spin.toFixed(1)+') scale('+m.scale.toFixed(3)+')';
      out['mateShadow'+i]='translate('+m.x.toFixed(2)+' '+(m.y+21*m.scale).toFixed(2)+') scale('+(m.air||m.show<1?0:1)+')';
    });
    return out;
  }
  // How visible each marble is (0 to 1). A stand-in fades in at the top of its fall. The marble that came down the run
  // is gone from the bridge on (it left the picture at misuse).
  const fades=p=>({traveller:p.left?0:1,contact:p.left?0:1,...Object.fromEntries(p.mates.map((m,i)=>['mate'+i,m.show]))});
  return {art,pose,transforms,fades,quake,ground,ride,brink,fastAt,surge,impact:()=>(typeof RunExplosion==='undefined'?require('./explosion.js'):RunExplosion).impact,fall,camera,times,ease,clamp,mix};
})();
if(typeof module!=='undefined')module.exports=MarbleRun;
