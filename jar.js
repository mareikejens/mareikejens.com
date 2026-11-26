const bottleArt = "\n      <svg viewBox=\"0 0 150 196\" aria-hidden=\"true\">\n        <defs>\n          <linearGradient id=\"jarGlassGradient\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"0\">\n            <stop offset=\"0\" class=\"jt\" stop-opacity=\".6\"/><stop offset=\".07\" class=\"jt\" stop-opacity=\".14\"/>\n            <stop offset=\".2\" class=\"js\" stop-opacity=\".36\"/><stop offset=\".36\" class=\"js\" stop-opacity=\".07\"/>\n            <stop offset=\".72\" class=\"js\" stop-opacity=\".05\"/><stop offset=\".9\" class=\"js\" stop-opacity=\".22\"/>\n            <stop offset=\".95\" class=\"jt\" stop-opacity=\".16\"/><stop offset=\"1\" class=\"jt\" stop-opacity=\".55\"/>\n          </linearGradient>\n          <linearGradient id=\"jb\" x1=\"0\" x2=\"0\" y1=\"0\" y2=\"1\"><stop offset=\"0\" class=\"js\" stop-opacity=\"0\"/><stop offset=\"1\" class=\"js\" stop-opacity=\".6\"/></linearGradient>\n        </defs>\n        <ellipse class=\"jar-floor\" cx=\"80\" cy=\"190\" rx=\"64\" ry=\"8\"/>\n        <ellipse class=\"jar-caustic\" cx=\"100\" cy=\"193\" rx=\"34\" ry=\"5\"/>\n        <path class=\"jar-glass\" d=\"M38 20 L38 34 C38 47 15 48 15 70 L15 168 C15 181 40 190 75 190 C110 190 135 181 135 168 L135 70 C135 48 112 47 112 34 L112 20 Z\"/>\n        <ellipse class=\"jar-back\" cx=\"75\" cy=\"14\" rx=\"37\" ry=\"5.5\"/>\n        <path class=\"jar-foot\" d=\"M16 158 L16 168 C16 181 41 189 75 189 C109 189 134 181 134 168 L134 158 C134 171 108 178 75 178 C42 178 16 171 16 158 Z\"/>\n      </svg>\n      <span class=\"jar-marbles\" ></span>\n      <svg viewBox=\"0 0 150 196\" aria-hidden=\"true\">\n        <path class=\"jar-edge\" d=\"M38 20 L38 34 C38 47 15 48 15 70 L15 168 C15 181 40 190 75 190 C110 190 135 181 135 168 L135 70 C135 48 112 47 112 34 L112 20 Z\"/>\n        <path class=\"jar-wall\" d=\"M43 24 L43 34 C43 50 21 51 21 71 L21 165 C21 176 43 183.5 75 183.5 C107 183.5 129 176 129 165 L129 71 C129 51 107 50 107 34 L107 24\"/>\n        <path class=\"jar-thread\" d=\"M38.5 27 Q75 35 111.5 27 M38.5 32.5 Q75 40.5 111.5 32.5\"/>\n        <path class=\"jar-lip\" fill-rule=\"evenodd\" d=\"M31 14 C31 6.5 119 6.5 119 14 C119 21.5 31 21.5 31 14 Z M38 14 C38 18.5 112 18.5 112 14 C112 9.5 38 9.5 38 14 Z\"/>\n        <path class=\"jar-hi\" d=\"M23.5 72 C20.5 102 20.5 140 24 164 C26 166.5 30 165.5 30.5 162 C27.5 138 27.5 102 30 74 C29 70 25 69.5 23.5 72 Z\"/>\n        <path class=\"jar-shine\" stroke-width=\"1.4\" opacity=\".85\" d=\"M35 80 C33.5 102 33.5 130 35.5 150\"/>\n        <path class=\"jar-shine\" stroke-width=\"3\" opacity=\".35\" d=\"M125 82 C126.5 100 126.5 128 125 148\"/>\n        <path class=\"jar-shine\" stroke-width=\"2\" opacity=\".75\" d=\"M21.5 61 C24 52 31 46 37 41\"/>\n        <path class=\"jar-shine\" stroke-width=\"1.6\" opacity=\".9\" d=\"M42 10.2 C55 8.2 80 8 96 9.2\"/>\n      </svg>\n      ";
// The jar is a real rigid-body world (Matter.js) in the bottle's own 150×196 drawing space.
// Marbles collide, roll, spin and settle; the DOM elements just follow the bodies.
const {Engine,Bodies,Body,Composite}=Matter;
const jarBodies=new Map();                        // idea id → {body, element}
const jarEngine=Engine.create({gravity:{x:0,y:1}});
const JAR_STEP=1000/120;                          // fixed step: same feel on 60 and 120 Hz screens
let jarFrame=0;
// Inside face of the glass, left side top→bottom. The right side is mirrored, the base is a shallow curve.
const jarLeft=[[41,-260],[41,30],[33,38],[25,48],[19,60],[17,74],[17,177]];
const jarBase=Array.from({length:9},(_,k)=>{const x=17+k*14.5;return [x,186-9*((x-75)/58)**2]});
(function buildJarWalls(){
  const line=[...jarLeft,...jarBase.slice(1,-1),...jarLeft.map(([x,y])=>[150-x,y]).reverse()];
  const thick=60;
  for(let k=0;k<line.length-1;k++){
    const [x1,y1]=line[k],[x2,y2]=line[k+1],mx=(x1+x2)/2,my=(y1+y2)/2,len=Math.hypot(x2-x1,y2-y1);
    let nx=-(y2-y1)/len,ny=(x2-x1)/len;
    if(nx*(75-mx)+ny*(100-my)<0){nx=-nx;ny=-ny}      // make the normal point into the jar
    Composite.add(jarEngine.world,Bodies.rectangle(mx-nx*thick/2,my-ny*thick/2,len+3,thick,{isStatic:true,angle:Math.atan2(y2-y1,x2-x1),friction:.12,restitution:.3}));
  }
})();
const jarRadius=n=>n<=6?17:n<=11?14.5:n<=18?12:n<=22?10.5:9.5;
let jarSettling=false;
function jarSpawn(id,k,burst,r,entry){
  const x=75+Math.sin(k*5+2)*7,y=burst?12-k*(2*r+1):12;
  const body=Bodies.circle(x,y,r,{restitution:.38,friction:.06,frictionStatic:.3,frictionAir:.003,density:.0025});
  Body.setVelocity(body,{x:burst?0:Math.sin(k*3+1)*1.1,y:burst?0:2.4});
  Body.setAngularVelocity(body,(Math.sin(k*7)*.5)*(burst?0:.2));
  if(entry){Body.setPosition(body,{x:entry.x,y:14});Body.setAngle(body,entry.angle);Body.setVelocity(body,entry.velocity);Body.setAngularVelocity(body,entry.spin)}
  Composite.add(jarEngine.world,body);
  jarBodies.set(id,{body,element:null});
}
function jarRelease(id){const e=jarBodies.get(id);if(e)Composite.remove(jarEngine.world,e.body);jarBodies.delete(id)}
const jarQuiet=(bodies,limit=.05)=>bodies.every(b=>b.speed<limit&&Math.abs(b.angularSpeed)<limit/6);
function mountJar(container=app.querySelector('.jar-marbles'),entry){
  cancelAnimationFrame(jarFrame);
  if(!container)return;
  const ids=[...state.picked],r=jarRadius(ids.length);
  const fresh=ids.filter(id=>!jarBodies.has(id));
  fresh.forEach((id,k)=>jarSpawn(id,k,fresh.length>1,r,fresh.length===1?entry:null));
  const items=ids.map(id=>{
    const e=jarBodies.get(id);
    if(Math.abs(e.body.circleRadius-r)>.01){const f=r/e.body.circleRadius;Body.scale(e.body,f,f)}
    container.insertAdjacentHTML('beforeend',ball(ideas.find(v=>v.id===id)));
    e.element=container.lastElementChild;e.element.style.setProperty('--diam',2*r+'px');return e;
  });
  const bodies=items.map(e=>e.body);
  const draw=()=>items.forEach(({body,element})=>element.style.transform='translate('+(body.position.x-r)+'px,'+(body.position.y-r)+'px) rotate('+body.angle+'rad)');
  // A returning visitor's whole jar, or reduced motion: settle off-screen and show the resting pile.
  if(fresh.length>1||reduced.matches){jarSettling=true;for(let n=0,calm=0;n<3000&&calm<60;n++){Engine.update(jarEngine,JAR_STEP);calm=jarQuiet(bodies)?calm+1:0}jarSettling=false;draw();return}
  let last=0,acc=0,still=0;
  function tick(now){
    if(!container.isConnected)return;
    acc+=last?Math.min(70,now-last):17;last=now;
    while(acc>=JAR_STEP){Engine.update(jarEngine,JAR_STEP);acc-=JAR_STEP}
    draw();
    still=jarQuiet(bodies,.08)?still+1:0;
    if(bodies.length&&still<60)jarFrame=requestAnimationFrame(tick);
  }
  draw();jarFrame=requestAnimationFrame(tick);
}
