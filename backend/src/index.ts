import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createExpressApp } from './http/server';
import { attachWebSocketServer } from './ws/index';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI!;
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const app = createExpressApp();
    const server = http.createServer(app);

    attachWebSocketServer(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
  }
}

startServer();
