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
exports.startWebSocketServer = startWebSocketServer;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const Chat_1 = require("../models/Chat");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
const users = [];
function checkUser(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return (decoded === null || decoded === void 0 ? void 0 : decoded.userId) || null;
    }
    catch (_a) {
        return null;
    }
}
function startWebSocketServer() {
    mongoose_1.default.connect(MONGO_URI).then(() => {
        console.log('✅ WS Server connected to MongoDB');
    }).catch(err => {
        console.error('❌ MongoDB WS connection error:', err);
    });
    const wss = new ws_1.WebSocketServer({ port: 8000 });
    wss.on('connection', (ws, request) => {
        const url = request.url;
        if (!url)
            return;
        const queryParams = new URLSearchParams(url.split('?')[1]);
        const token = queryParams.get('token') || '';
        const userId = checkUser(token);
        if (!userId) {
            ws.close();
            return;
        }
        users.push({ userId, rooms: [], ws });
        ws.on('message', (data) => __awaiter(this, void 0, void 0, function* () {
            let parsedData;
            try {
                parsedData = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
            }
            catch (err) {
                console.error('Invalid JSON:', err);
                return;
            }
            const user = users.find(u => u.ws === ws);
            if (!user)
                return;
            switch (parsedData.type) {
                case 'join_room':
                    user.rooms.push(parsedData.roomId);
                    break;
                case 'leave_room':
                    user.rooms = user.rooms.filter(room => room !== parsedData.roomId);
                    break;
                case 'chat':
                    yield Chat_1.Chat.create({ roomId: parsedData.roomId, userId: user.userId, message: parsedData.message });
                    users.forEach(u => {
                        if (u.rooms.includes(parsedData.roomId)) {
                            u.ws.send(JSON.stringify({ type: 'chat', message: parsedData.message, roomId: parsedData.roomId }));
                        }
                    });
                    break;
                case 'drawing':
                    yield Chat_1.Chat.create({ roomId: parsedData.roomId, userId: user.userId, message: JSON.stringify(parsedData.elements) });
                    users.forEach(u => {
                        if (u.rooms.includes(parsedData.roomId)) {
                            u.ws.send(JSON.stringify({ type: 'drawing', elements: parsedData.elements, roomId: parsedData.roomId }));
                        }
                    });
                    break;
            }
        }));
        ws.on('close', () => {
            const index = users.findIndex(u => u.ws === ws);
            if (index !== -1)
                users.splice(index, 1);
        });
    });
    console.log('🚀 WebSocket Server running on ws://localhost:8000');
}
