const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws, req) => {
  const parameters = url.parse(req.url, true);
  const roomId = parameters.query.roomId;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch (data.action) {
      case 'join':
        if (!rooms[roomId]) {
          rooms[roomId] = new Set();
        }
        rooms[roomId].add(ws);
        break;
      case 'offer':
      case 'answer':
      case 'ice-candidate':
      case 'sync-video':
        rooms[roomId].forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
        break;
    }
  });

  ws.on('close', () => {
    if (rooms[roomId]) {
      rooms[roomId].delete(ws);
      if (rooms[roomId].size === 0) {
        delete rooms[roomId];
      }
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});