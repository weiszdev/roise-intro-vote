const HTML = __HTML__;
const AUDIO = __AUDIO__;
const TITLES = {1:"Follow the Journey, take 1 (Original)",2:"Roll Out, take 1 (Original)",3:"Roll Out, take 2 (Original)",4:"Follow the Journey, country hip-hop take 1 (New - Royce)",5:"Follow the Journey, country hip-hop take 2 (New - Royce)",6:"Roll Out, country hip-hop take 1 (New - Royce)",7:"Roll Out, country hip-hop take 2 (New - Royce)"};
function dec(b){const s=atob(b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
const cache={};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function sha(s){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function keyOk(env,k){if(!k||!env.RESULTS_KEY||k.length!==env.RESULTS_KEY.length)return false;let r=0;for(let i=0;i<k.length;i++)r|=k.charCodeAt(i)^env.RESULTS_KEY.charCodeAt(i);return r===0;}
async function counts(env){
  const rs=await env.DB.prepare('SELECT option_id, COUNT(*) AS n FROM votes GROUP BY option_id').all();
  const c={};for(let i=1;i<=7;i++)c[i]=0;let total=0;
  for(const r of rs.results){c[r.option_id]=r.n;total+=r.n;}
  return {counts:c,total};
}
const chi=ms=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(ms));
async function recent(env){
  const rs=await env.DB.prepare('SELECT option_id,name,created_at,updated_at FROM votes ORDER BY updated_at DESC LIMIT 200').all();
  return rs.results.map(r=>({option:r.option_id,title:TITLES[r.option_id],name:r.name||'',first_voted:chi(r.created_at),last_updated:chi(r.updated_at),changed:r.updated_at!==r.created_at}));
}
async function handleVote(req,env){
  const origin=req.headers.get('origin');
  if(origin&&new URL(origin).host!==new URL(req.url).host)return J({error:'bad origin'},403);
  let b;try{const t=await req.text();if(t.length>2000)return J({error:'too big'},413);b=JSON.parse(t);}catch(e){return J({error:'bad json'},400);}
  const opt=Number(b.option);
  if(!Number.isInteger(opt)||opt<1||opt>7)return J({error:'option must be 1-7'},400);
  const vid=String(b.voter_id||'');
  if(!/^[A-Za-z0-9-]{16,64}$/.test(vid))return J({error:'bad voter id'},400);
  const name=String(b.name||'').replace(/[\u0000-\u001f\u007f<>]/g,'').trim().slice(0,80);
  const ip=req.headers.get('cf-connecting-ip')||'';
  const ih=(await sha((env.IP_SALT||'')+ip)).slice(0,32);
  const now=Date.now();
  const rl=await env.DB.prepare('SELECT COUNT(*) AS n FROM rate WHERE ip_hash=? AND ts>?').bind(ih,now-10*60*1000).first();
  if(rl.n>=20)return J({error:'Too many votes from your network right now. Please wait a few minutes and try again.'},429);
  await env.DB.prepare('INSERT INTO rate(ip_hash,ts) VALUES(?,?)').bind(ih,now).run();
  if(Math.random()<0.1)await env.DB.prepare('DELETE FROM rate WHERE ts<?').bind(now-3600*1000).run();
  const prev=await env.DB.prepare('SELECT option_id FROM votes WHERE voter_id=?').bind(vid).first();
  await env.DB.prepare('INSERT INTO votes(voter_id,option_id,name,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(voter_id) DO UPDATE SET option_id=excluded.option_id,name=excluded.name,updated_at=excluded.updated_at').bind(vid,opt,name,now,now).run();
  return J({ok:true,option:opt,changed:!!prev&&prev.option_id!==opt,already:!!prev&&prev.option_id===opt,...await counts(env)});
}
async function resultsPage(env,key){
  const {counts:c,total}=await counts(env);
  const full=keyOk(env,key);
  const max=Math.max(1,...Object.values(c));
  let rows='';for(let i=1;i<=7;i++)rows+=`<tr><td>${i}</td><td>${esc(TITLES[i])}</td><td class="n">${c[i]}</td><td><div class="bar" style="width:${Math.round(c[i]/max*100)}%"></div></td></tr>`;
  let rec='';
  if(full){const r=await recent(env);rec=`<h2>Recent votes (America/Chicago)</h2><table><tr><th>When</th><th>Name</th><th>Voted for</th></tr>${r.map(v=>`<tr><td>${esc(v.last_updated)}${v.changed?' <em>(changed; first voted '+esc(v.first_voted)+')</em>':''}</td><td>${esc(v.name||'(no name)')}</td><td>#${v.option} ${esc(v.title)}</td></tr>`).join('')||'<tr><td colspan="3">No votes yet.</td></tr>'}</table>`;}
  else rec='<p class="note">Names and times are shown only on the private results link.</p>';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="30"><title>Vote results</title><style>body{font-family:Georgia,serif;background:#bfe3ef;color:#0c2236;margin:0}header{background:#0f2d4a;color:#ffd66b;text-align:center;padding:20px}main{max-width:900px;margin:0 auto;padding:16px}table{width:100%;border-collapse:collapse;background:#fbfeff;border:2px solid #1d5f7a;margin-bottom:18px}td,th{padding:8px 10px;border-bottom:1px solid #bfe3ef;text-align:left;vertical-align:middle}th{background:#e0f3f8}.n{font-weight:bold;font-size:1.2rem;width:50px}.bar{height:16px;background:#e0562d;border-radius:8px;min-width:2px}h2{color:#0f2d4a}.note{background:#fff1c9;border:2px solid #e0562d;padding:8px 12px;border-radius:8px}</style></head><body><header><h1>Vote results</h1><div>${total} vote${total===1?'':'s'} total &middot; refreshes every 30 seconds</div></header><main><table><tr><th>#</th><th>Option</th><th>Votes</th><th></th></tr>${rows}</table>${rec}<p><a href="/">Back to the vote page</a></p></main></body></html>`;
}
export default {
  async fetch(req,env){
    const url=new URL(req.url);
    const p=url.pathname;
    if(p==='/'||p==='/index.html'){return new Response(HTML,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache'}});}
    if(p==='/api/vote'){
      if(req.method!=='POST')return J({error:'POST only'},405);
      try{return await handleVote(req,env);}catch(e){return J({error:'server error'},500);}
    }
    if(p==='/api/results'){
      try{const r=await counts(env);if(keyOk(env,url.searchParams.get('key')))r.recent=await recent(env);return J(r);}catch(e){return J({error:'server error'},500);}
    }
    if(p==='/results'||p==='/results/'){
      try{return new Response(await resultsPage(env,url.searchParams.get('key')),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});}catch(e){return new Response('Error',{status:500});}
    }
    const m=p.match(/^\/audio\/([a-z0-9-]+\.mp3)$/);
    if(m&&AUDIO[m[1]]){
      const d=cache[m[1]]||(cache[m[1]]=dec(AUDIO[m[1]]));
      const h={'content-type':'audio/mpeg','accept-ranges':'bytes','cache-control':'public, max-age=86400'};
      const r=req.headers.get('range');
      const mm=r&&r.match(/bytes=(\d*)-(\d*)/);
      if(mm){
        let s=mm[1]===''?Math.max(0,d.length-parseInt(mm[2])):parseInt(mm[1]);
        let e=(mm[1]===''||mm[2]==='')?d.length-1:Math.min(parseInt(mm[2]),d.length-1);
        if(s>e||s>=d.length)return new Response(null,{status:416,headers:{'content-range':'bytes */'+d.length}});
        h['content-range']='bytes '+s+'-'+e+'/'+d.length;h['content-length']=String(e-s+1);
        return new Response(req.method==='HEAD'?null:d.slice(s,e+1),{status:206,headers:h});
      }
      h['content-length']=String(d.length);
      return new Response(req.method==='HEAD'?null:d,{headers:h});
    }
    return new Response('Not found',{status:404});
  }
};
