
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILocation extends Document {
  name: string;
  description?: string;
  inventoryType?: string;
  category?: string;
  items?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    inventoryType: { type: String, required: false },
    category: { type: String, required: false },
    items: [{ type: String }], // Array of Item IDs
  },
  {
    timestamps: true,
  }
);

const Location: Model<ILocation> =
  mongoose.models.Location || mongoose.model<ILocation>("Location", LocationSchema);

export default Location;
