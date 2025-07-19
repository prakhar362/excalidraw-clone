import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { Chat } from '../models/Chat';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET!;

interface UserType {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: UserType[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch {
    return null;
  }
}

export function attachWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const url = req.url ?? '';
    const token = new URLSearchParams(url.split('?')[1]).get('token') || '';
    const userId = checkUser(token);
    if (!userId) return ws.close();

    users.push({ ws, rooms: [], userId });

    ws.on('message', async (data) => {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
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
              users.forEach(u => {
                if (u.ws !== ws && u.rooms.includes(roomId)) {
                  u.ws.send(JSON.stringify({
                    type: 'cursor',
                    roomId,
                    pointer: parsed.pointer,
                    clientId: parsed.clientId,
                    color: parsed.color,
                    username,
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

  console.log('🚀 WebSocket Server attached');
}
