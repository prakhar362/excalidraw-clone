import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  photo?: string;
  googleId?: string;
  authProvider: "local" | "google";
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  photo: { type: String, default: null },
   googleId: {
      type: String,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      required: true,
      default: "local",
    },

}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
export const User = mongoose.model<IUser>('User', userSchema);
