import mongoose, { Schema } from "mongoose";
const ProjectSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
}, {
    timestamps: true,
});
export const Project = mongoose.model("Project", ProjectSchema);
