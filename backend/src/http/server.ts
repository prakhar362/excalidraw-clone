import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { middleware } from './middleware';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { Chat } from '../models/Chat';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const MONGO_URI = process.env.MONGO_URI!;


export function createExpressApp() {
  const app = express();
  app.use(express.json());
  app.use(cors({
    origin: [
      'https://your-frontend.vercel.app',
      'http://localhost:3000'
    ],
    credentials: true
  }));

  app.get('/', (req, res) => {
    res.send('http server backend running');
  });

// ---------------------- SIGNUP ----------------------
app.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Missing inputs' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword, name });

    res.json({ userId: user._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------- LOGIN ----------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing inputs' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(403).json({ message: 'Not authorized' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(403).json({ message: 'Not authorized' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET);
    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------------------- CREATE ROOM ----------------------
app.post('/create-room', middleware, async (req: any, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing room name' });

  try {
    const exists = await Room.findOne({ slug: name });
    if (exists) return res.status(409).json({ message: 'Room already exists' });

    const room = await Room.create({ slug: name, adminId: req.userId });
    res.json({ roomId: room._id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create room' });
  }
});

// ---------------------- GET ALL ROOMS ----------------------
app.get('/my-rooms', middleware, async (req: any, res) => {
  try {
    const userId = req.userId;

    const rooms = await Room.find({
      $or: [
        { adminId: userId },
        { collaborators: userId }
      ]
    }).sort({ createdAt: -1 });
    console.log(rooms);
    res.json({ rooms });
  } catch (e) {
    console.error('Failed to fetch user rooms:', e);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});



// ---------------------- GET CHATS ----------------------
app.get('/chats/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const messages = await Chat.find({ roomId }).sort({ createdAt: -1 }).limit(1000);
    res.json({ messages });
  } catch (e) {
    console.error(e);
    res.json({ messages: [] });
  }
});

// ---------------------- GET ROOM DETAILS ----------------------
app.get('/room/:slug', async (req, res) => {
  const slug = req.params.slug;
  const room = await Room.findOne({ slug });
  res.json({ room });
});

// ---------------------- ADD COLLABORATOR TO ROOM ----------------------
app.post('/rooms/:roomId/add-collaborator', middleware, async (req, res) => {
  const { roomId } = req.params;
  const { username } = req.body;

  if (!username) return res.status(400).json({ message: 'Username is required' });

  try {
    const userToAdd = await User.findOne({ name: username });
    if (!userToAdd) return res.status(404).json({ message: 'No such user found' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // Ensure collaborators array exists
    if (!Array.isArray(room.collaborators)) {
      room.collaborators = [];
    }

    // Check if already a collaborator
    const isAlreadyCollaborator = room.collaborators.some(
      (id) => id.toString() === userToAdd._id.toString()
    );
    if (isAlreadyCollaborator) {
      return res.status(400).json({ message: 'User is already a collaborator' });
    }

    // Don't allow admin to add themselves again
    if (room.adminId.toString() === userToAdd._id.toString()) {
      return res.status(400).json({ message: 'Admin is already in the room' });
    }

    // Add collaborator and save
    room.collaborators.push(userToAdd._id);
    await room.save();

    res.status(200).json({ message: `${username} added as collaborator`, collaboratorId: userToAdd._id });
  } catch (e) {
    console.error('Error adding collaborator:', e);
    res.status(500).json({ message: 'Failed to add collaborator' });
  }
});


// ---------------------- STORE CHAT ----------------------
app.post('/chats/:roomId', middleware, async (req: any, res) => {
  try {
    const roomId = req.params.roomId;
    const { message } = req.body;

    await Chat.create({
      roomId,
      userId: req.userId,
      message
    });

    res.status(200).json({ message: 'Drawing stored' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to store drawing' });
  }
});

  return app;
}