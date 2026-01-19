
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  phone: string;
  role: string;
  locations: string[];
  lastSelectedLocation?: string;
  lastSelectedDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Optional for now to support existing users, but logic should enforce it
    phone: { type: String, required: false },
    role: { type: String, required: true, default: "Staff" },
    locations: { type: [String], default: [] },
    lastSelectedLocation: { type: String, required: false },
    lastSelectedDate: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists to prevent overwrite error in hot reload
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
