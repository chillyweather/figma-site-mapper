import mongoose, { Schema, Document, Types } from "mongoose";

export interface IElement extends Document {
  pageId: Types.ObjectId;
  projectId: Types.ObjectId;
  type: string;
  selector?: string;
  tagName?: string;
  elementId?: string;
  classes?: string[];
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  href?: string;
  text?: string;
  styles?: Record<string, any>;
  styleTokens?: string[];
  ariaLabel?: string;
  role?: string;
  value?: string;
  placeholder?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
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
    selector: {
      type: String,
      trim: true,
    },
    tagName: {
      type: String,
      trim: true,
    },
    elementId: {
      type: String,
      trim: true,
    },
    classes: {
      type: [String],
      default: [],
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
    styleTokens: {
      type: [String],
      default: [],
    },
    ariaLabel: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      trim: true,
    },
    value: {
      type: String,
      trim: true,
    },
    placeholder: {
      type: String,
      trim: true,
    },
    checked: {
      type: Boolean,
    },
    src: {
      type: String,
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
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
