import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  roomId: mongoose.Types.ObjectId;
  message: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const chatSchema = new Schema<IChat>({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Chat = mongoose.model<IChat>('Chat', chatSchema);
