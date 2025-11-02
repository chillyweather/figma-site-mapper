import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPage extends Document {
  projectId: Types.ObjectId;
  url: string;
  title: string;
  screenshotPaths: string[];
  globalStyles?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema = new Schema<IPage>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    screenshotPaths: {
      type: [String],
      default: [],
    },
    globalStyles: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Create unique compound index on projectId and url
PageSchema.index({ projectId: 1, url: 1 }, { unique: true });

export const Page = mongoose.model<IPage>("Page", PageSchema);
