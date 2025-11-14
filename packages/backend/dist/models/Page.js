import mongoose, { Schema } from "mongoose";
const PageSchema = new Schema({
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
    interactiveElements: {
        type: [
            new Schema({
                type: {
                    type: String,
                    required: true,
                    enum: ["link", "button"],
                },
                x: { type: Number, required: true },
                y: { type: Number, required: true },
                width: { type: Number, required: true },
                height: { type: Number, required: true },
                href: { type: String, trim: true },
                text: { type: String, trim: true },
            }, { _id: false }),
        ],
        default: [],
    },
    globalStyles: {
        type: Schema.Types.Mixed,
        default: {},
    },
    lastCrawledAt: {
        type: Date,
        default: null,
    },
    lastCrawlJobId: {
        type: String,
        default: null,
        trim: true,
    },
}, {
    timestamps: true,
});
// Create unique compound index on projectId and url
PageSchema.index({ projectId: 1, url: 1 }, { unique: true });
export const Page = mongoose.model("Page", PageSchema);
