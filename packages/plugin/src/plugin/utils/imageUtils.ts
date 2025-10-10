/**
 * Extract image dimensions from PNG data
 */
export function getImageDimensionsFromPNG(imageData: Uint8Array): {
  width: number;
  height: number;
} {
  // PNG format: width is at bytes 16-19, height is at bytes 20-23 (big-endian)
  if (
    imageData[0] === 0x89 &&
    imageData[1] === 0x50 &&
    imageData[2] === 0x4e &&
    imageData[3] === 0x47
  ) {
    const width =
      (imageData[16] << 24) |
      (imageData[17] << 16) |
      (imageData[18] << 8) |
      imageData[19];
    const height =
      (imageData[20] << 24) |
      (imageData[21] << 16) |
      (imageData[22] << 8) |
      imageData[23];
    return { width, height };
  }

  console.warn("Could not parse image dimensions, using default");
  return { width: 1280, height: 1000 };
}
