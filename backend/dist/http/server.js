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
exports.startHttpServer = startHttpServer;
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const middleware_1 = require("./middleware");
const User_1 = require("../models/User");
const Room_1 = require("../models/Room");
const Chat_1 = require("../models/Chat");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI;
function startHttpServer() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cors_1.default)());
    mongoose_1.default.connect(MONGO_URI).then(() => {
        console.log('✅ Connected to MongoDB');
    }).catch((err) => {
        console.error('❌ MongoDB connection failed:', err);
    });
    app.get('/', (req, res) => {
        res.send('http server backend running');
    });
    // ---------------------- SIGNUP ----------------------
    app.post('/signup', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'Missing inputs' });
        }
        try {
            const existing = yield User_1.User.findOne({ email });
            if (existing)
                return res.status(409).json({ message: 'Email already exists' });
            const hashedPassword = yield bcrypt_1.default.hash(password, 10);
            const user = yield User_1.User.create({ email, password: hashedPassword, name });
            res.json({ userId: user._id });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ---------------------- LOGIN ----------------------
    app.post('/login', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'Missing inputs' });
        try {
            const user = yield User_1.User.findOne({ email });
            if (!user)
                return res.status(403).json({ message: 'Not authorized' });
            const valid = yield bcrypt_1.default.compare(password, user.password);
            if (!valid)
                return res.status(403).json({ message: 'Not authorized' });
            const token = jsonwebtoken_1.default.sign({ userId: user._id }, JWT_SECRET);
            res.json({ token });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ message: 'Server error' });
        }
    }));
    // ---------------------- CREATE ROOM ----------------------
    app.post('/create-room', middleware_1.middleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { name } = req.body;
        if (!name)
            return res.status(400).json({ message: 'Missing room name' });
        try {
            const exists = yield Room_1.Room.findOne({ slug: name });
            if (exists)
                return res.status(409).json({ message: 'Room already exists' });
            const room = yield Room_1.Room.create({ slug: name, adminId: req.userId });
            res.json({ roomId: room._id });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ message: 'Failed to create room' });
        }
    }));
    // ---------------------- GET ALL ROOMS ----------------------
    app.get('/my-rooms', middleware_1.middleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const userId = req.userId;
            const rooms = yield Room_1.Room.find({
                $or: [
                    { adminId: userId },
                    { collaborators: userId }
                ]
            }).sort({ createdAt: -1 });
            console.log(rooms);
            res.json({ rooms });
        }
        catch (e) {
            console.error('Failed to fetch user rooms:', e);
            res.status(500).json({ message: 'Failed to fetch rooms' });
        }
    }));
    // ---------------------- GET CHATS ----------------------
    app.get('/chats/:roomId', (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const roomId = req.params.roomId;
            const messages = yield Chat_1.Chat.find({ roomId }).sort({ createdAt: -1 }).limit(1000);
            res.json({ messages });
        }
        catch (e) {
            console.error(e);
            res.json({ messages: [] });
        }
    }));
    // ---------------------- GET ROOM DETAILS ----------------------
    app.get('/room/:slug', (req, res) => __awaiter(this, void 0, void 0, function* () {
        const slug = req.params.slug;
        const room = yield Room_1.Room.findOne({ slug });
        res.json({ room });
    }));
    // ---------------------- ADD COLLABORATOR TO ROOM ----------------------
    app.post('/rooms/:roomId/add-collaborator', middleware_1.middleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        const { roomId } = req.params;
        const { username } = req.body;
        if (!username)
            return res.status(400).json({ message: 'Username is required' });
        try {
            const userToAdd = yield User_1.User.findOne({ name: username });
            if (!userToAdd)
                return res.status(404).json({ message: 'No such user found' });
            const room = yield Room_1.Room.findById(roomId);
            if (!room)
                return res.status(404).json({ message: 'Room not found' });
            // Ensure collaborators array exists
            if (!Array.isArray(room.collaborators)) {
                room.collaborators = [];
            }
            // Check if already a collaborator
            const isAlreadyCollaborator = room.collaborators.some((id) => id.toString() === userToAdd._id.toString());
            if (isAlreadyCollaborator) {
                return res.status(400).json({ message: 'User is already a collaborator' });
            }
            // Don't allow admin to add themselves again
            if (room.adminId.toString() === userToAdd._id.toString()) {
                return res.status(400).json({ message: 'Admin is already in the room' });
            }
            // Add collaborator and save
            room.collaborators.push(userToAdd._id);
            yield room.save();
            res.status(200).json({ message: `${username} added as collaborator`, collaboratorId: userToAdd._id });
        }
        catch (e) {
            console.error('Error adding collaborator:', e);
            res.status(500).json({ message: 'Failed to add collaborator' });
        }
    }));
    // ---------------------- STORE CHAT ----------------------
    app.post('/chats/:roomId', middleware_1.middleware, (req, res) => __awaiter(this, void 0, void 0, function* () {
        try {
            const roomId = req.params.roomId;
            const { message } = req.body;
            yield Chat_1.Chat.create({
                roomId,
                userId: req.userId,
                message
            });
            res.status(200).json({ message: 'Drawing stored' });
        }
        catch (e) {
            console.error(e);
            res.status(500).json({ message: 'Failed to store drawing' });
        }
    }));
    app.listen(5000, () => {
        console.log('🚀 HTTP SERVER RUNNING on http://localhost:5000');
    });
}
