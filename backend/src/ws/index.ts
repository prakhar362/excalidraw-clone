import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Chat } from '../models/Chat';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const MONGO_URI = process.env.MONGO_URI!;

const users: {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

export function startWebSocketServer() {
  mongoose.connect(MONGO_URI).then(() => {
    console.log('✅ WS Server connected to MongoDB');
  }).catch(err => {
    console.error('❌ MongoDB WS connection error:', err);
  });

  const wss = new WebSocketServer({ port: 8000 });

  wss.on('connection', (ws, request) => {
    const url = request.url;
    if (!url) return;

    const queryParams = new URLSearchParams(url.split('?')[1]);
    const token = queryParams.get('token') || '';
    const userId = checkUser(token);

    if (!userId) {
      ws.close();
      return;
    }

    users.push({ userId, rooms: [], ws });

    ws.on('message', async (data) => {
      let parsedData: any;
      try {
        parsedData = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
      } catch (err) {
        console.error('Invalid JSON:', err);
        return;
      }

      const user = users.find(u => u.ws === ws);
      if (!user) return;

      switch (parsedData.type) {
        case 'join_room':
          user.rooms.push(parsedData.roomId);
          break;

        case 'leave_room':
          user.rooms = user.rooms.filter(room => room !== parsedData.roomId);
          break;

        case 'chat':
          await Chat.create({ roomId: parsedData.roomId, userId: user.userId, message: parsedData.message });
          users.forEach(u => {
            if (u.rooms.includes(parsedData.roomId)) {
              u.ws.send(JSON.stringify({ type: 'chat', message: parsedData.message, roomId: parsedData.roomId }));
            }
          });
          break;

        case 'drawing':
          await Chat.create({ roomId: parsedData.roomId, userId: user.userId, message: JSON.stringify(parsedData.elements) });
          users.forEach(u => {
            if (u.rooms.includes(parsedData.roomId)) {
              u.ws.send(JSON.stringify({ type: 'drawing', elements: parsedData.elements, roomId: parsedData.roomId }));
            }
          });
          break;
      }
    });

    ws.on('close', () => {
      const index = users.findIndex(u => u.ws === ws);
      if (index !== -1) users.splice(index, 1);
    });
  });

  console.log('🚀 WebSocket Server running on ws://localhost:8000');
}
