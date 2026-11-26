// Tells Mareike's backend what a visitor looks at: which ideas they open, how long they stay on a card,
// and what goes into their jar. Each event carries a random visit number (and the name, once it is given in the
// send form), so a visit is useful even when the visitor never sends their jar. Visitors are currently not told: the welcome line was removed
// on 26 Nov ("notice" in content.js is empty). Put a disclosure back somewhere before this runs on a live host.
const Track=(()=>{
  const endpoint=window.IDEA_MAP.send?.trackEndpoint;
  let visitor='';
  try{visitor=sessionStorage.getItem('idea-map-visitor')||'';if(!visitor){visitor=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem('idea-map-visitor',visitor)}}catch{}
  // keepalive lets the request finish even while the page is closing.
  function send(type,data={}){
    if(!endpoint||location.protocol==='file:'||!visitor)return;
    try{fetch(endpoint,{method:'POST',keepalive:true,
      body:JSON.stringify({visitor,name:state.fullName,type,...data,jar:[...state.picked]})}).catch(()=>{})}catch{}
  }
  return {send,get visitor(){return visitor}};
})();
