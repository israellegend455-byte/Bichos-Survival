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
http.createServer((req,res)=>{
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
  if(u.pathname==='/salud')return send(res,200,{ok:true,jugadores:Object.keys(DB).length});
  if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/index.html')){
    try{const h=fs.readFileSync(path.join(__dirname,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(h);}catch(e){return send(res,500,{error:'falta index.html'});}
  }
  send(res,404,{error:'no existe'});
}).listen(PORT,()=>console.log('Ranking en puerto '+PORT));
