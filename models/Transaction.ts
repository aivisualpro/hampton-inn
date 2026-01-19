import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITransaction extends Document {
  date: Date;
  item: string; // Item ID
  location: string; // Location ID
  countedUnit: number;
  countedPackage: number;
  purchasedUnit: number;
  purchasedPackage: number;
  consumedUnit: number;
  consumedPackage: number;
  soakUnit: number; // For tracking items in soak cycle
  relatedParentItem?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    date: { type: Date, required: true },
    item: { type: String, required: true },
    location: { type: String, required: true },
    countedUnit: { type: Number, default: 0 },
    countedPackage: { type: Number, default: 0 },
    purchasedUnit: { type: Number, default: 0 },
    purchasedPackage: { type: Number, default: 0 },
    consumedUnit: { type: Number, default: 0 },
    consumedPackage: { type: Number, default: 0 },
    soakUnit: { type: Number, default: 0 },
    relatedParentItem: { type: Schema.Types.ObjectId, ref: "Item", required: false },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
TransactionSchema.index({ date: 1, item: 1, location: 1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction || mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
