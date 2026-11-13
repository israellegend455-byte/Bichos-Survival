// Servidor de ranking de Bichos Survivor. Sin dependencias: solo Node 18+.
// Sirve el juego (index.html) y el ranking desde la misma URL.
// Uso: node server.js   (puerto con la variable PORT, por defecto 3000)
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000;
const FILE=process.env.DATA_FILE||path.join(__dirname,'ranking.json');
let DB={};try{DB=JSON.parse(fs.readFileSync(FILE,'utf8'));}catch(e){}
const FILET=process.env.DATA_FILE_T||path.join(__dirname,'torre.json');
let TDB={};try{TDB=JSON.parse(fs.readFileSync(FILET,'utf8'));}catch(e){}
let dirtyT=false;
setInterval(()=>{if(!dirtyT)return;dirtyT=false;try{fs.writeFileSync(FILET,JSON.stringify(TDB));}catch(e){console.error('no pude guardar torre',e.message);}},5000);
const topT=n=>Object.entries(TDB).map(([id,r])=>Object.assign({id},r)).sort((a,b)=>b.f-a.f||(b.hd?1:0)-(a.hd?1:0)||a.tm-b.tm).slice(0,n);
let dirty=false;
setInterval(()=>{if(!dirty)return;dirty=false;try{fs.writeFileSync(FILE,JSON.stringify(DB));}catch(e){console.error('no pude guardar',e.message);}},5000);
const FILEU=process.env.DATA_FILE_U||path.join(__dirname,'ultras.json');
let UDB={pulls:{},wins:[]};try{UDB=Object.assign(UDB,JSON.parse(fs.readFileSync(FILEU,'utf8')));}catch(e){}
let dirtyU=false;
setInterval(()=>{if(!dirtyU)return;dirtyU=false;try{fs.writeFileSync(FILEU,JSON.stringify(UDB));}catch(e){console.error('no pude guardar ultras',e.message);}},5000);
const FILEG=process.env.DATA_FILE_G||path.join(__dirname,'tags.json');
let TG={};try{TG=JSON.parse(fs.readFileSync(FILEG,'utf8'))||{};}catch(e){}
const saveTg=()=>{try{fs.writeFileSync(FILEG,JSON.stringify(TG));}catch(e){}};
const TAGOK=['owner','fundador','veterano','antiguo','leyenda','torre'];
const FILEE=process.env.DATA_FILE_E||path.join(__dirname,'evento.json');
let EVT={m:2,end:0};try{EVT=Object.assign(EVT,JSON.parse(fs.readFileSync(FILEE,'utf8')));}catch(e){}
const saveEv=()=>{try{fs.writeFileSync(FILEE,JSON.stringify(EVT));}catch(e){}};
const UNAME={u1:'Primesis',u2:'Primeris'};
function ultStats(){
  const out={};
  for(const u of ['u1','u2']){
    const P=UDB.pulls[u]||{y:0,g:0,pl:{}},W=UDB.wins.filter(w=>w.u===u),ids=new Set(W.map(w=>w.id)),sn=W.map(w=>w.since);
    out[u]={name:UNAME[u],players:Object.keys(P.pl||{}).length,y:P.y||0,g:P.g||0,total:(P.y||0)+(P.g||0),hits:W.length,winners:ids.size,
      byY:W.filter(w=>w.tk==='y').length,byG:W.filter(w=>w.tk==='g').length,
      avg:sn.length?Math.round(sn.reduce((a,b)=>a+b,0)/sn.length):0,min:sn.length?Math.min(...sn):0,max:sn.length?Math.max(...sn):0,
      latest:W.slice(-15).reverse().map(w=>({name:w.name,tk:w.tk,since:w.since,sh:w.sh,ts:w.ts}))};
  }
  return out;
}
const hits={};
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-Owner'};
const send=(res,code,obj)=>{res.writeHead(code,Object.assign({'Content-Type':'application/json'},CORS));res.end(JSON.stringify(obj));};
const top=n=>Object.entries(DB).map(([id,r])=>Object.assign({id},r)).sort((a,b)=>b.t-a.t||a.ts-b.ts).slice(0,n);
const server=http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,CORS);return res.end();}
  const u=new URL(req.url,'http://x');
  if(req.method==='GET'&&u.pathname==='/rank'){
    const id=u.searchParams.get('id'); const rows=top(Math.min(50,+u.searchParams.get('limit')||30)).map(r=>({name:r.name,t:r.t,k:r.k,kind:r.kind,sh:r.sh,id:r.id.slice(0,6),tag:TG[r.id]||''}));
    return send(res,200,{rows,mine:id&&DB[id]?DB[id]:null});
  }
  if(req.method==='POST'&&u.pathname==='/rank'){
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress,now=Date.now();
    if(hits[ip]&&now-hits[ip]<1500)return send(res,429,{error:'muy rápido'}); hits[ip]=now;
    let b='';req.on('data',c=>{b+=c;if(b.length>2000)req.destroy();});
    req.on('end',()=>{
      let d;try{d=JSON.parse(b);}catch(e){return send(res,400,{error:'json'});}
      const id=String(d.id||'').slice(0,40),name=String(d.name||'').trim().replace(/\s+/g,' ').slice(0,14),t=Math.floor(+d.t);
      if(id.length<8||!name||!(t>=1&&t<=36000))return send(res,400,{error:'datos'});
      const old=DB[id],k=Math.max(0,Math.min(1e6,Math.floor(+d.k)||0)),kind=String(d.kind||'').slice(0,20).replace(/[^a-z0-9_]/gi,'');
      if(!old||t>old.t)DB[id]={name,t,k,kind,sh:!!d.sh,ts:now}; else if(old.name!==name)old.name=name;
      dirty=true; send(res,200,{ok:true,mine:DB[id]});
    });
    return;
  }
  if(req.method==='GET'&&u.pathname==='/torre'){
    const id=u.searchParams.get('id');const rows=topT(30).map(r=>({name:r.name,f:r.f,hd:r.hd,tm:r.tm,kind:r.kind,sh:r.sh,id:r.id.slice(0,6),tag:TG[r.id]||''}));
    return send(res,200,{rows,mine:id&&TDB[id]?TDB[id]:null});
  }
  if(req.method==='POST'&&u.pathname==='/torre'){
    const ip=req.headers['x-forwarded-for']||req.socket.remoteAddress,now=Date.now();
    if(hits['t'+ip]&&now-hits['t'+ip]<1500)return send(res,429,{error:'muy rápido'});hits['t'+ip]=now;
    let b='';req.on('data',c=>{b+=c;if(b.length>2000)req.destroy();});
    req.on('end',()=>{
      let d;try{d=JSON.parse(b);}catch(e){return send(res,400,{error:'json'});}
      const id=String(d.id||'').slice(0,40),name=String(d.name||'').trim().replace(/\s+/g,' ').slice(0,14),f=Math.floor(+d.f),tm=Math.floor(+d.tm),hd=d.hd?1:0;
      if(id.length<8||!name||!(f>=1&&f<=20)||!(tm>=1&&tm<=36000))return send(res,400,{error:'datos'});
      const old=TDB[id],kind=String(d.kind||'').slice(0,20).replace(/[^a-z0-9_]/gi,'');
      const better=!old||f>old.f||(f===old.f&&(hd>(old.hd?1:0)||(hd===(old.hd?1:0)&&tm<old.tm)));
      if(better)TDB[id]={name,f,tm,hd,kind,sh:!!d.sh,ts:now};else if(old.name!==name)old.name=name;
      dirtyT=true;send(res,200,{ok:true,mine:TDB[id]});
    });
    return;
  }
  if(req.method==='POST'&&u.pathname==='/ultra'){
    let b='';req.on('data',c=>{b+=c;if(b.length>2000)req.destroy();});
    req.on('end',()=>{
      let d;try{d=JSON.parse(b);}catch(e){return send(res,400,{error:'json'});}
      const id=String(d.id||'').slice(0,40),name=String(d.name||'Anónimo').trim().replace(/\s+/g,' ').slice(0,14)||'Anónimo',uu=d.u,tk=d.tk,n=Math.floor(+d.n);
      if(id.length<8||!(uu==='u1'||uu==='u2')||!(tk==='y'||tk==='g')||!(n>=1&&n<=50))return send(res,400,{error:'datos'});
      const P=UDB.pulls[uu]=UDB.pulls[uu]||{y:0,g:0,pl:{}};P[tk]+=n;P.pl[id]=(P.pl[id]||0)+n;
      if(d.hit){const since=Math.floor(+d.hit.since);if(since>=1&&since<=1e7){UDB.wins.push({id,name,u:uu,tk,since,sh:!!d.hit.sh,ts:Date.now()});if(UDB.wins.length>5000)UDB.wins.shift();}}
      dirtyU=true;send(res,200,{ok:true});
    });
    return;
  }
  if(req.method==='POST'&&u.pathname==='/tag'){
    let b='';req.on('data',c=>{b+=c;if(b.length>500)req.destroy();});
    req.on('end',()=>{let d={};try{d=JSON.parse(b);}catch(e){}
      const id=String(d.id||'').slice(0,40),tag=String(d.tag||'');
      if(id.length<8)return send(res,400,{error:'id'});
      if(tag&&!TAGOK.includes(tag))return send(res,400,{error:'tag'});
      if(tag==='owner'&&!isOwner(req.headers['x-owner']))return send(res,403,{error:'no'});
      if(TG[id]==='owner'&&tag!=='owner'&&!isOwner(req.headers['x-owner']))return send(res,200,{ok:1,tag:TG[id]});
      if(tag)TG[id]=tag;else delete TG[id];saveTg();send(res,200,{ok:1,tag});});
    return;
  }
  if(u.pathname==='/evento'){
    if(req.method==='GET')return send(res,200,{m:EVT.m,end:EVT.end>Date.now()?EVT.end:0,now:Date.now()});
    if(req.method==='POST'){
      if(!isOwner(req.headers['x-owner']))return send(res,403,{error:'no'});
      let b='';req.on('data',c=>{b+=c;if(b.length>500)req.destroy();});
      req.on('end',()=>{let d={};try{d=JSON.parse(b);}catch(e){}
        const h=Math.max(0,Math.min(168,+d.h||0)),m=Math.max(1,Math.min(5,+d.m||2));
        EVT={m,end:h?Date.now()+h*36e5:0};saveEv();send(res,200,{ok:1,m:EVT.m,end:EVT.end,now:Date.now()});});
      return;
    }
  }
  if(req.method==='GET'&&u.pathname==='/ultras'){
    if(!isOwner(req.headers['x-owner']))return send(res,403,{error:'no'});
    if(u.searchParams.get('dl')){res.writeHead(200,Object.assign({'Content-Type':'application/json','Content-Disposition':'attachment; filename="ultras-respaldo.json"'},CORS));return res.end(JSON.stringify(UDB));}
    return send(res,200,{ok:1,banners:ultStats()});
  }
  if(u.pathname==='/salud')return send(res,200,{ok:true,jugadores:Object.keys(DB).length,salas:Object.keys(rooms).length});
  if(req.method==='GET'&&/^\/audio\/(menu|play|rift|stand|lms|creator|torre|tboss|hcboss|ultra1|ultra2)\.mp3$/.test(u.pathname)){
    try{const fp=path.join(__dirname,u.pathname),st=fs.statSync(fp),r=req.headers.range,h={'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400'};
      if(r){const m=/bytes=(\d*)-(\d*)/.exec(r),s0=m[1]?+m[1]:0,e0=m[2]?+m[2]:st.size-1;res.writeHead(206,Object.assign(h,{'Content-Range':'bytes '+s0+'-'+e0+'/'+st.size,'Content-Length':e0-s0+1}));return fs.createReadStream(fp,{start:s0,end:e0}).pipe(res);}
      res.writeHead(200,Object.assign(h,{'Content-Length':st.size}));return fs.createReadStream(fp).pipe(res);}catch(e){return send(res,404,{error:'no audio'});}
  }
  if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/index.html')){
    try{const h=fs.readFileSync(path.join(__dirname,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(h);}catch(e){return send(res,500,{error:'falta index.html'});}
  }
  send(res,404,{error:'no existe'});
});
/* ---------- salas cooperativas (el host manda; el servidor solo reenvía) ---------- */
const crypto=require('crypto');
/* WebSocket mínimo (RFC 6455), sin dependencias */
const clients=new Set(), MAXP=300000;
function wsSend(ws,str){
  if(ws.readyState!==1)return;
  const p=Buffer.from(str),n=p.length;let h;
  if(n<126)h=Buffer.from([0x81,n]);else if(n<65536){h=Buffer.alloc(4);h[0]=0x81;h[1]=126;h.writeUInt16BE(n,2);}else{h=Buffer.alloc(10);h[0]=0x81;h[1]=127;h.writeBigUInt64BE(BigInt(n),2);}
  try{ws.sock.write(Buffer.concat([h,p]));}catch(e){}
}
server.on('upgrade',(req,sock)=>{
  const u=new URL(req.url,'http://x');
  const key=req.headers['sec-websocket-key'];
  if(u.pathname!=='/ws'||!key){sock.destroy();return;}
  const acc=crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+acc+'\r\n\r\n');
  sock.setNoDelay(true);
  const ws={sock,readyState:1,alive:true,handlers:{},send:s=>wsSend(ws,s),on(e,f){ws.handlers[e]=f;},terminate(){try{sock.destroy();}catch(e){}},ping(){try{sock.write(Buffer.from([0x89,0]));}catch(e){}}};
  clients.add(ws);
  let buf=Buffer.alloc(0),frag='';
  const closeAll=()=>{if(ws.readyState===3)return;ws.readyState=3;clients.delete(ws);if(ws.handlers.close)ws.handlers.close();};
  sock.on('data',d=>{
    buf=Buffer.concat([buf,d]);
    while(buf.length>=2){
      const fin=!!(buf[0]&128),op=buf[0]&15,mk=!!(buf[1]&128);let len=buf[1]&127,off=2;
      if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4;}else if(len===127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10;}
      if(len>MAXP){ws.terminate();return;}
      const need=off+(mk?4:0)+len;if(buf.length<need)return;
      let pl=buf.subarray(off+(mk?4:0),need);
      if(mk){const k=buf.subarray(off,off+4),o=Buffer.alloc(len);for(let i=0;i<len;i++)o[i]=pl[i]^k[i&3];pl=o;}
      buf=buf.subarray(need);
      if(op===8){try{sock.write(Buffer.from([0x88,0]));}catch(e){}sock.end();closeAll();return;}
      else if(op===9){try{sock.write(Buffer.concat([Buffer.from([0x8a,pl.length]),pl]));}catch(e){}}
      else if(op===10){ws.alive=true;}
      else if(op===1||op===0){frag+=pl.toString('utf8');if(fin){const m=frag;frag='';if(ws.handlers.message)ws.handlers.message(m);}}
    }
  });
  sock.on('close',closeAll);sock.on('error',closeAll);
  connect(ws);
});
const rooms={};
const isOwner=k=>!!(process.env.OWNER_KEY&&String(k||'').trim().toUpperCase()===process.env.OWNER_KEY.trim().toUpperCase());
const mkCode=()=>{const A='ABCDEFGHJKLMNPQRSTUVWXYZ';let c;do{c='';for(let i=0;i<4;i++)c+=A[Math.floor(Math.random()*A.length)];}while(rooms[c]);return c;};
const tx=(ws,o)=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));};
const txr=(ws,raw)=>{if(ws&&ws.readyState===1)ws.send(raw);};
const bcast=(r,raw)=>{for(const w of r.slots)txr(w,raw);};
/* sala: 1 host + hasta 3 invitados (slots 1..3). El host manda; el servidor solo reenvia. */
function connect(ws){
  ws.on('message',raw=>{
    let m;try{m=JSON.parse(raw);}catch(e){return;}
    if(!m||typeof m!=='object')return;
    if(m.t==='create'){
      if(ws.room)return;const c=mkCode();rooms[c]={host:ws,slots:[null,null,null],name:String(m.name||'Host').slice(0,14),started:false};ws.room=c;ws.role='host';ws.own=isOwner(m.ok);tx(ws,{t:'room',code:c,own:ws.own});return;
    }
    if(m.t==='join'){
      if(ws.room)return;
      const c=String(m.code||'').toUpperCase().trim(),r=rooms[c];
      if(!r)return tx(ws,{t:'err',msg:'Esa sala no existe'});
      if(r.started)return tx(ws,{t:'err',msg:'La partida ya empezó'});
      const i=r.slots.indexOf(null);if(i<0)return tx(ws,{t:'err',msg:'La sala ya está llena'});
      r.slots[i]=ws;ws.room=c;ws.role='guest';ws.idx=i+1;ws.own=isOwner(m.ok);
      tx(ws,{t:'joined',code:c,idx:i+1,host:r.name,own:ws.own});
      tx(r.host,{t:'peer',f:i+1,own:ws.own,name:String(m.name||'Amigo').slice(0,14),kind:String(m.kind||'').slice(0,20),sh:!!m.sh,pre:m.pre||null});return;
    }
    const r=rooms[ws.room];if(!r)return;
    if(ws.role==='host'){
      if(m.t==='start')r.started=true;if(m.t==='over')r.started=false;
      if(m.to>=1&&m.to<=3)txr(r.slots[m.to-1],raw);else bcast(r,raw);
    }else{
      m.f=ws.idx;txr(r.host,JSON.stringify(m));
    }
  });
  ws.on('close',()=>{
    const r=rooms[ws.room];if(!r)return;
    if(ws.role==='host'){bcast(r,JSON.stringify({t:'closed'}));for(const w of r.slots)if(w)w.room=null;delete rooms[ws.room];}
    else{r.slots[ws.idx-1]=null;tx(r.host,{t:'left',f:ws.idx});}
  });
}
setInterval(()=>{clients.forEach(ws=>{if(!ws.alive)return ws.terminate();ws.alive=false;ws.ping();});},25000);
server.listen(PORT,()=>console.log('Bichos Survivor en puerto '+PORT));
