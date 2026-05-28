import { buildMappingWorkspace } from "../../services/mapping/index.js";
export async function mappingPrepareHandler(job) {
    const { projectId } = job.data;
    if (!projectId) {
        throw new Error("Mapping prepare job is missing projectId");
    }
    console.log(`🗺️  Processing job ${job.id}: Building mapping workspace for project ${projectId}`);
    await job.updateData({
        ...job.data,
        progress: { stage: "building-mapping-workspace", progress: 10, timestamp: new Date().toISOString() },
    });
    try {
        const result = await buildMappingWorkspace(projectId);
        await job.updateData({
            ...job.data,
            ...result,
            lastCompletedAt: new Date().toISOString(),
            progress: { stage: "completed", progress: 100, timestamp: new Date().toISOString() },
        });
        console.log(`✅ Finished mapping workspace job ${job.id}`);
        return result;
    }
    catch (error) {
        console.error(`❌ Mapping workspace job ${job.id} failed:`, error);
        throw error;
    }
}
