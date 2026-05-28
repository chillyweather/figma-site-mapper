import sharp from "sharp";
// Returns a 0-1 score: fraction of the (normalized) image height that forms
// the largest contiguous run of near-uniform rows. 0 = clean, 1 = entirely blank.
export async function scoreSuspiciousRegions(buffer) {
    // Normalize to a compact grid for consistent analysis regardless of
    // original dimensions, while keeping enough horizontal samples that varied
    // content does not average into a uniform row.
    const { data, info } = await sharp(buffer)
        .resize(80, 300, { fit: "fill" })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const rowWidth = info.width;
    const height = info.height; // 300
    const LOW_VARIANCE_THRESHOLD = 8; // stddev below this → blank row
    let maxBlankRun = 0;
    let currentRun = 0;
    for (let row = 0; row < height; row++) {
        const start = row * rowWidth;
        let sum = 0;
        for (let i = start; i < start + rowWidth; i++)
            sum += data[i];
        const mean = sum / rowWidth;
        let variance = 0;
        for (let i = start; i < start + rowWidth; i++)
            variance += (data[i] - mean) ** 2;
        const stddev = Math.sqrt(variance / rowWidth);
        if (stddev < LOW_VARIANCE_THRESHOLD) {
            currentRun++;
            if (currentRun > maxBlankRun)
                maxBlankRun = currentRun;
        }
        else {
            currentRun = 0;
        }
    }
    return maxBlankRun / height;
}
