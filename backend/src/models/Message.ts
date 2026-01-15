import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Indexing roomId for faster message retrieval when opening a canvas
messageSchema.index({ roomId: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);