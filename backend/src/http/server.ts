import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from 'dotenv';
import { middleware } from './middleware';
import { User } from '../models/User';
import { Room } from '../models/Room';
import { Chat } from '../models/Chat';
import nodemailer from 'nodemailer';

dotenv.config();
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: "/auth/google/callback",
      proxy: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0].value;

        if (!email) {
          return done(new Error("No email returned from Google"), undefined);
        }

        let user = await User.findOne({ email });

        // 🔁 Account linking
        if (!user) {
          user = await User.create({
            email,
            name: profile.displayName,
            password: "GOOGLE_OAUTH", // placeholder
            googleId: profile.id,
            authProvider: "google", 
          });


        } else if (!user.googleId) {
          user.googleId = profile.id;
          user.authProvider = "google";
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }
  )
);

const JWT_SECRET = process.env.JWT_SECRET!;
const MONGO_URI = process.env.MONGO_URI!;


export function createExpressApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(passport.initialize());

  app.use(cors({
    origin: [
      'https://sketchcalibur.vercel.app',
      'http://localhost:3000'
    ],
    credentials: true
  }));

  app.get('/', (req, res) => {
    res.send('http server backend running');
  });

// ---------------------- SIGNUP ----------------------
app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Missing inputs" });
  }

  try {
    const existing = await User.findOne({ email });

    //  Email already exists
    if (existing) {
      // Google account exists → tell user what to do
      if (existing.authProvider === "google") {
        return res.status(409).json({
          message: "Account exists. Please sign up using Google",
        });
      }

      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      authProvider: "local",
    });

    return res.status(201).json({ userId: user._id });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// ---------------------- LOGIN ----------------------
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Missing inputs" });
  }

  try {
    const user = await User.findOne({ email });

    // ❌ User not found
    if (!user) {
      return res.status(403).json({ message: "Invalid email or password" });
    }

    // 🔐 Google-only account
    if (user.authProvider === "google") {
      return res.status(403).json({
        message: "This account uses Google sign-in",
      });
    }

    // 🔐 Local account but password missing (edge safety)
    if (!user.password) {
      return res.status(403).json({
        message: "Password login unavailable for this account",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    // ❌ Wrong password
    if (!validPassword) {
      return res.status(403).json({ message: "Invalid email or password" });
    }

    // ✅ Success
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
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
  const { username, useremail } = req.body;

  if (!username || !useremail) return res.status(400).json({ message: 'Username or User email is required' });

  try {
    const userToAdd = await User.findOne({ name: username });
    if (!userToAdd) {
      // Fetch the room to get the slug
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }
      // Send invitation email using nodemailer
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: process.env.GMAIL_USER!,
            pass: process.env.GMAIL_PASS!,
          },
        });
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: useremail,
          subject: `Invitation to join SketchCalibur Room`,
          text: `Hello,\n\nYou have been invited to join the room '${room.slug}' on SketchCalibur. Please create an account using this email to join the room as a collaborator.\n\nBest regards,\nSketchCalibur Team`,
        };
        await transporter.sendMail(mailOptions);
        return res.status(404).json({ message: 'No such user found, but an invitation email has been sent to create an account and join the room!' });
        
      } catch (mailErr) {
        console.error('Failed to send invitation email:', mailErr);
        return res.status(404).json({ message: 'No such user found, and failed to send invitation email.' });
      }
    }

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

// ---------------------- GOOGLE AUTH ----------------------
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// backend/routes/auth.ts (or your main file)

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "https://sketchcalibur.vercel.app/auth", // Redirect on fail
  }),
  (req, res) => {
    const user = req.user as any;

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 🚀 REDIRECT back to frontend with the token in the URL
    // Use your production URL here
    const frontendUrl = "https://sketchcalibur.vercel.app/dashboard"; 
    return res.redirect(`${frontendUrl}?token=${token}`);
  }
);

  return app;
}