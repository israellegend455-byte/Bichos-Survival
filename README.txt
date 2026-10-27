BICHOS SURVIVOR - pagina web con ranking (todo en uno)

Esta carpeta ES la pagina: server.js sirve el juego (index.html) y guarda el ranking.
Tus amigos solo abren la URL, sin archivos ni links de artifact.

Probar en tu compu:  node server.js   y abre http://localhost:3000

Publicarla gratis (Render):
 1. Sube esta carpeta a un repo de GitHub (o usa "Public Git repository").
 2. En render.com: New > Web Service > conecta el repo.
 3. Runtime: Node. Build command: (vacio). Start command: node server.js
 4. Cuando termine te da una URL tipo https://bichos-survivor.onrender.com. Esa es tu pagina.

Para actualizar el juego: reemplaza index.html y vuelve a desplegar.
Nota: en plan gratis la primera visita tarda ~30 s (se duerme) y el ranking.json se pierde
si el servicio se reinicia. Si quieres ranking permanente, dime y lo paso a base de datos.

v1.1: ahora el servidor tambien maneja salas cooperativas (WebSocket en /ws), sin dependencias nuevas.
