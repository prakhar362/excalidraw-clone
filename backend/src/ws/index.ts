import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Chat } from '../models/Chat';
import { User } from '../models/User'; // 👈 Assuming you have this model

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const MONGO_URI = process.env.MONGO_URI!;

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export function startWebSocketServer() {
  mongoose.connect(MONGO_URI).then(() => {
    console.log('✅ WS Server connected to MongoDB');
  });

  const wss = new WebSocketServer({ port: 8000 });

  wss.on('connection', (ws, req) => {
    const url = req.url ?? '';
    const token = new URLSearchParams(url.split('?')[1]).get('token') || '';
    const userId = checkUser(token);
    if (!userId) return ws.close();

    users.push({ ws, rooms: [], userId });

    ws.on('message', async (data) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
        //console.log("Recived from client Prakhar: ",parsed);
        const user = users.find(u => u.ws === ws);
        if (!user) return;

        const { type, roomId, message, elements, clientId } = parsed;

        switch (type) {
          case 'join_room':
            if (!user.rooms.includes(roomId)) user.rooms.push(roomId);
            break;

         case 'drawing':
  users.forEach(u => {
    if (u.ws !== ws && u.rooms.includes(roomId)) {
      u.ws.send(JSON.stringify({
        type: 'drawing',
        roomId,
        elements,
        clientId
      }));
    }
  });
  break;

case 'cursor': {
  try {
    const dbUser = await User.findById(user.userId).select('name');
    if (!dbUser) return;

    const username = dbUser.name;
    // console.log("Cursor sending username: ",username);

    users.forEach(u => {
      if (u.ws !== ws && u.rooms.includes(roomId)) {
        u.ws.send(JSON.stringify({
          type: 'cursor',
          roomId,
          pointer: parsed.pointer,
          clientId: parsed.clientId,
          color: parsed.color,
          username, // 👈 Send real name from DB
        }));
      }
    });
  } catch (err) {
    console.error('Error fetching username:', err);
  }
  break;
}


        }
      } catch (e) {
        console.error('WebSocket Error:', e);
      }
    });

    

    ws.on('close', () => {
      const idx = users.findIndex(u => u.ws === ws);
      if (idx !== -1) users.splice(idx, 1);
    });
  });

  console.log('🚀 WebSocket Server running on ws://localhost:8000');
}
