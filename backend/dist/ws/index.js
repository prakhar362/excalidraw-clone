"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachWebSocketServer = attachWebSocketServer;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET;
const users = [];
function checkUser(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded.userId;
    }
    catch (_a) {
        return null;
    }
}
function attachWebSocketServer(server) {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
        var _a;
        const url = (_a = req.url) !== null && _a !== void 0 ? _a : '';
        const token = new URLSearchParams(url.split('?')[1]).get('token') || '';
        const userId = checkUser(token);
        if (!userId)
            return ws.close();
        users.push({ ws, rooms: [], userId });
        ws.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
                const user = users.find(u => u.ws === ws);
                if (!user)
                    return;
                const { type, roomId, message, elements, clientId } = parsed;
                switch (type) {
                    case 'join_room':
                        if (!user.rooms.includes(roomId))
                            user.rooms.push(roomId);
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
                            const dbUser = yield User_1.User.findById(user.userId).select('name');
                            if (!dbUser)
                                return;
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
                        }
                        catch (err) {
                            console.error('Error fetching username:', err);
                        }
                        break;
                    }
                }
            }
            catch (e) {
                console.error('WebSocket Error:', e);
            }
        }));
        ws.on('close', () => {
            const idx = users.findIndex(u => u.ws === ws);
            if (idx !== -1)
                users.splice(idx, 1);
        });
    });
    console.log('🚀 WebSocket Server attached');
}
