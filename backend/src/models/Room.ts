import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  slug: string;
  adminId: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[]; // NEW
  createdAt: Date;
}

const roomSchema = new Schema<IRoom>({
  slug: { type: String, required: true, unique: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // NEW
  createdAt: { type: Date, default: Date.now },
});

export const Room = mongoose.model<IRoom>('Room', roomSchema);
