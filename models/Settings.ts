
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings extends Document {
  defaultKingRoomCount: number;
  defaultDoubleQueenRoomCount: number;
  parLevelThreshold: number;
}

const SettingsSchema: Schema = new Schema(
  {
    defaultKingRoomCount: { type: Number, default: 0 },
    defaultDoubleQueenRoomCount: { type: Number, default: 0 },
    parLevelThreshold: { type: Number, default: 1 },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists to prevent overwrite error in hot reload
// In development, delete the model if it exists to ensure schema changes are picked up
if (process.env.NODE_ENV === "development" && mongoose.models.Settings) {
  delete mongoose.models.Settings;
}

const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);

export default Settings;
