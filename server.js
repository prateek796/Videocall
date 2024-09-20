const WebSocket = require('ws');
const http = require('http');
const url = require('url');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws, req) => {
  const parameters = url.parse(req.url, true);
  const roomId = parameters.query.roomId;

  console.log(`New connection to room ${roomId}`);

  if (!rooms[roomId]) {
    rooms[roomId] = new Set();
  }
  
  // Notify existing users in the room about the new user
  rooms[roomId].forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        action: 'user-joined',
        userId: ws.id
      }));
    }
  });

  // Add the new user to the room
  ws.id = Math.random().toString(36).substr(2, 9);
  rooms[roomId].add(ws);

  // Send the 'user-joined' message to the new user for each existing user
  rooms[roomId].forEach((client) => {
    if (client !== ws) {
      ws.send(JSON.stringify({
        action: 'user-joined',
        userId: client.id
      }));
    }
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log(`Received message in room ${roomId}:`, data);
    
    rooms[roomId].forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on('close', () => {
    console.log(`Connection closed in room ${roomId}`);
    rooms[roomId].delete(ws);
    if (rooms[roomId].size === 0) {
      delete rooms[roomId];
    } else {
      // Notify other users that this user has left
      rooms[roomId].forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            action: 'user-left',
            userId: ws.id
          }));
        }
      });
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});