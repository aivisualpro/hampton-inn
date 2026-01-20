
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOccupancy extends Document {
  date: Date;
  count: number;
  percentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const OccupancySchema: Schema = new Schema(
  {
    date: { type: Date, required: true, unique: true },
    count: { type: Number, required: true, default: 0 },
    percentage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists to prevent overwrite error in hot reload
const Occupancy: Model<IOccupancy> =
  mongoose.models.Occupancy || mongoose.model<IOccupancy>("Occupancy", OccupancySchema);

export default Occupancy;
