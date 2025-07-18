import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';

export interface IRoom extends Document {
  slug: string;
  adminId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const roomSchema = new Schema<IRoom>({
  slug: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Room = mongoose.model<IRoom>('Room', roomSchema);
