import mongoose, { Schema, Document, Types } from "mongoose";

export interface IElement extends Document {
  pageId: Types.ObjectId;
  projectId: Types.ObjectId;
  type: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  href?: string;
  text?: string;
  styles?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ElementSchema = new Schema<IElement>(
  {
    pageId: {
      type: Schema.Types.ObjectId,
      ref: "Page",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    bbox: {
      type: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      },
      required: false,
    },
    href: {
      type: String,
      trim: true,
    },
    text: {
      type: String,
      trim: true,
    },
    styles: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create compound indexes for efficient queries
ElementSchema.index({ pageId: 1, type: 1 });
ElementSchema.index({ projectId: 1, type: 1 });

export const Element = mongoose.model<IElement>("Element", ElementSchema);
