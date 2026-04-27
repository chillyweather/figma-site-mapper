import { buildWorkspace } from "../../services/workspace/index.js";
export async function inventoryPrepareHandler(job) {
    const { projectId } = job.data;
    if (!projectId) {
        throw new Error("Inventory prepare job is missing projectId");
    }
    console.log(`📦 Processing job ${job.id}: Building inventory workspace for project ${projectId}`);
    await job.updateData({
        ...job.data,
        progress: { stage: "building-workspace", progress: 10, timestamp: new Date().toISOString() },
    });
    try {
        const result = await buildWorkspace(projectId, { verbose: true });
        await job.updateData({
            ...job.data,
            ...result,
            lastCompletedAt: new Date().toISOString(),
            progress: { stage: "completed", progress: 100, timestamp: new Date().toISOString() },
        });
        console.log(`✅ Finished inventory workspace job ${job.id}`);
        return result;
    }
    catch (error) {
        console.error(`❌ Inventory workspace job ${job.id} failed:`, error);
        throw error;
    }
}
