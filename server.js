// Servidor de ranking de Bichos Survivor. Sin dependencias: solo Node 18+.
// Sirve el juego (index.html) y el ranking desde la misma URL.
// Uso: node server.js   (puerto con la variable PORT, por defecto 3000)
const http=require('http'),fs=require('fs'),path=require('path');
const PORT=process.env.PORT||3000;
const FILE=process.env.DATA_FILE||path.join(__dirname,'ranking.json');
let DB={};try{DB=JSON.parse(fs.readFileSync(FILE,'utf8'));}catch(e){}
let dirty=false;
setInterval(()=>{if(!dirty)return;dirty=false;try{fs.writeFileSync(FILE,JSON.stringify(DB));}catch(e){console.error('no pude guardar',e.message);}},5000);
const hits={};
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
const send=(res,code,obj)=>{res.writeHead(code,Object.assign({'Content-Type':'application/json'},CORS));res.end(JSON.stringify(obj));};
const top=n=>Object.entries(DB).map(([id,r])=>Object.assign({id},r)).sort((a,b)=>b.t-a.t||a.ts-b.ts).slice(0,n);
const server=http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,CORS);return res.end();}
  const u=new URL(req.url,'http://x');
  if(req.method==='GET'&&u.pathname==='/rank'){
    const id=u.searchParams.get('id'); const rows=top(Math.min(50,+u.searchParams.get('limit')||30)).map(r=>({name:r.name,t:r.t,k:r.k,kind:r.kind,sh:r.sh,id:r.id.slice(0,6)}));
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
  if(u.pathname==='/salud')return send(res,200,{ok:true,jugadores:Object.keys(DB).length,salas:Object.keys(rooms).length});
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
