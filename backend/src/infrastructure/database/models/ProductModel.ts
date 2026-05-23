import mongoose, { Schema, Document } from 'mongoose';

export interface ProductDocument extends Document {
  productId: string;
  name: string;
  code: string;
  description?: string;
  basePricing: number;
  features: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDocument>(
  {
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true },
    basePricing: { type: Number, required: true, min: 0, default: 0 },
    features: [{ type: String, trim: true }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

export const ProductModel = mongoose.model<ProductDocument>('Product', productSchema);
