
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IItem extends Document {
  item: string;
  category: string;
  subCategory: string;
  costPerPackage: number;
  package: string;
  restockPackageQty: number;
  defaultKingRoomQty: number;
  defaultDoubleQueenQty: number;
  isBundle?: boolean;
  bundleItems?: { item: string; quantity: number }[];
  isDailyCount?: boolean;
  cookingQty?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema: Schema = new Schema(
  {
    item: { type: String, required: true },
    category: { type: String, required: true },
    subCategory: { type: String, required: false },
    costPerPackage: { type: Number, required: true, default: 0 },
    package: { type: String, required: false }, // e.g., "Box of 10", "Case"
    restockPackageQty: { type: Number, required: true, default: 0 },
    defaultKingRoomQty: { type: Number, required: true, default: 0 },
    defaultDoubleQueenQty: { type: Number, required: true, default: 0 },
    isBundle: { type: Boolean, default: false },
    bundleItems: [
      {
        item: { type: Schema.Types.ObjectId, ref: "Item" },
        quantity: { type: Number, required: true, default: 1 },
      },
    ],
    isDailyCount: { type: Boolean, default: false },
    cookingQty: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

// Check if model already exists to prevent overwrite error in hot reload
const Item: Model<IItem> =
  mongoose.models.Item || mongoose.model<IItem>("Item", ItemSchema);

export default Item;
