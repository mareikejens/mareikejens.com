// The entire break is sampled from one clock. Running that clock backwards
// brings every piece back along its own path, including the small rebounds.
const RunExplosion = (() => {
  const clamp = value => Math.max(0, Math.min(1, value));
  const onset = .22, impact = .59, floorY = 342;
  const rad = Math.PI/180;
  const fmt = n => Number(n.toFixed(3));

  // The fragments are photographed-looking chunks of the same marble (assets/shards), not slices of
  // the round picture: thin slices lying flat on the floor could not be told apart from a clipping error.
  // [width, height] of each sprite in drawing units. The marble itself is 38 across.
  const unit = .078;
  const sprites = [[368,381],[208,173],[408,310],[420,468],[272,248],[324,439],[278,285]].map(([w,h])=>[w*unit,h*unit]);
  const files = [1,6,4,0,5,2,3];   // which picture each fragment uses: large and small alternate along the floor

  // Unevenly scattered, so they do not line up in a row.
  const shards = [
    {dx:-132, lift:34}, {dx:-92, lift:58},
    {dx:-52, lift:42}, {dx:-4, lift:64},
    {dx:40, lift:29}, {dx:84, lift:48},
    {dx:128, lift:22}
  ];
  const rails = [
    {pin:344, start:0, tilt:8, slide:-17},
    {pin:609, start:.02, tilt:58, slide:53},
    {pin:902, start:.07, tilt:30, slide:70},
    {pin:1375, start:.11, tilt:-24, slide:-21},
    {pin:1490, start:.21, tilt:32, slide:44},
    {pin:2003, start:.32, tilt:-19, slide:-23},
    {pin:2230, start:.43, tilt:21, slide:28}
  ];
  // How far the sprite's box reaches below its centre once turned by `angle`. Upright (0°) that is half its height.
  const reach = (i,angle) => Math.abs(sprites[i][0]/2*Math.sin(angle*rad))+Math.abs(sprites[i][1]/2*Math.cos(angle*rad));
  const wrap = degrees => ((degrees+180)%360+360)%360-180;

  function art() {
    // Shadows first, so every fragment lies on top of all of them.
    return sprites.map(([w],i)=>'<ellipse id="shardShadow'+i+'" rx="'+fmt(w*.62)+'" ry="'+fmt(Math.max(1.6,w*.11))+'" fill="url(#shadow)"/>').join('')+
      sprites.map(([w,h],i)=>'<g id="shard'+i+'"><image href="assets/shards/shard-'+files[i]+'.webp" x="'+fmt(-w/2)+'" y="'+fmt(-h/2)+'" width="'+fmt(w)+'" height="'+fmt(h)+'"/></g>').join('');
  }
  // The marble arrives at speed, so it is thrown forward as it drops: fast at first, then mostly falling.
  function ball(clock, initialY) {
    const run = clamp(clock/onset), drop = clamp((clock-onset)/(impact-onset));
    return {
      x:550+13*run+110*(1-(1-drop)**2),
      y:initialY+.715*run+(floorY-19-initialY-.715)*drop*drop
    };
  }
  // Each support gives way a little after its neighbour. The easing has a
  // short overshoot and decays completely at rest.
  function railTransform(rail, progress) {
    const u=clamp((progress-rail.start)/.53);
    const fall=u*u*(3-2*u)+.18*Math.sin(3*Math.PI*u)*u*(1-u);
    return 'translate('+fmt(rail.slide*fall)+' 0) rotate('+fmt(rail.tilt*fall)+' '+rail.pin+' '+floorY+')';
  }
  function transforms(p) {
    const out={}, phase=p.breakage, release=clamp((phase-onset)/(1-onset));
    rails.forEach((rail,i)=>{out['part'+i]=railTransform(rail,release)});
    const fractured=phase>=impact;
    out.traveller='translate('+fmt(p.x)+' '+fmt(p.y)+') rotate('+fmt(p.spin)+') scale('+(fractured?0:1)+')';
    out.contact='translate('+fmt(p.x)+' '+fmt(p.y+21)+') scale('+(p.airborne?0:fmt(1-clamp((phase-onset)/.055)))+')';
    const time=clamp((phase-impact)/(1-impact));
    shards.forEach((s,i)=>{
      if(!fractured){out['shard'+i]=out['shardShadow'+i]='scale(0)';return}
      // The first arc starts at impact. The shorter second arc comes from
      // the same floor, with horizontal travel slowing through both contacts.
      const bounceAt=.52+.035*(i%4);
      const u=clamp(time/bounceAt),v=clamp((time-bounceAt)/(.23+.015*(i%3)));
      const hop=4*s.lift*u*(1-u)+4*s.lift*.19*v*(1-v);
      const x=p.x+s.dx*(1-(1-time)**1.8);
      // Tumble roughly as far as planned, ending upright: the pictures show each piece as it lies.
      // Neighbours spin a whole turn one way, not at all, or a whole turn the other way.
      const turn=wrap(-p.spin)+(i%3-1)*360;
      const spin=p.spin+turn*(1-(1-time)**2);
      const rest=floorY-reach(i,spin);
      const y=p.y+(rest-p.y)*u-hop;
      // At the instant of impact the pieces still fill the marble's outline, then open up to full size.
      const size=.55+.45*clamp(time/.14);
      out['shard'+i]='translate('+fmt(x)+' '+fmt(y)+') rotate('+fmt(spin)+') scale('+fmt(size)+')';
      // The shadow sits on the floor under the piece and tightens as the piece comes down.
      const near=clamp(1-(rest-y)/46)*clamp(time/.2);
      out['shardShadow'+i]='translate('+fmt(x)+' '+fmt(floorY+.5)+') scale('+fmt(near)+')';
    });
    return out;
  }
  return {onset,impact,art,ball,transforms};
})();
if(typeof module!=='undefined')module.exports=RunExplosion;
