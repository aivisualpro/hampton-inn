import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBreakfastImage extends Document {
  date: string; // YYYY-MM-DD format
  url: string;
  publicId: string; // Cloudinary public_id for deletion
  thumbnailUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const BreakfastImageSchema: Schema = new Schema(
  {
    date: { type: String, required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Index for efficient date-based queries
BreakfastImageSchema.index({ date: 1, createdAt: 1 });

const BreakfastImage: Model<IBreakfastImage> =
  mongoose.models.BreakfastImage || mongoose.model<IBreakfastImage>("BreakfastImage", BreakfastImageSchema);

export default BreakfastImage;
