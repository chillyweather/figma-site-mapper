export function createJobDispatcher(handlers, defaultHandler) {
    return async (job) => {
        const type = job.data?.type;
        const handler = (type && handlers[type]) || defaultHandler;
        if (!handler) {
            throw new Error(`No handler registered for job type: ${type}`);
        }
        return handler(job);
    };
}
