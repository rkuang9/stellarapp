/**
 * Get the shape of an image. This requires a browser environment
 * due to DOM usage.
 * 
 * @return the shape of the image in the format `[ width, height, channels ]`
 */
export async function getImageShape(image: Blob): Promise<number[]> {
    const bit_map = await createImageBitmap(image);
    const { width, height } = bit_map;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        bit_map.close();
        throw new Error("Failed to create a canvas context");
    }

    canvas.width = width;
    canvas.height = height;
    // no offset, draw full image starting from top-left
    context.drawImage(bit_map, 0, 0);

    const pixels = context.getImageData(0, 0, width, height).data;

    // loop over every 4th element (alpha channel)
    for (let i = 3; i < pixels.length; i += 4) {
        // alpha channel is not fully opaque
        if (pixels[i] !== 255) {
            bit_map.close();
            return [height, width, 4] // RGBA
        }
    }

    // alpha channel is all 255, so image is just RGB
    bit_map.close();
    return [height, width, 3];
}
