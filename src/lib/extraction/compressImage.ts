import sharp from 'sharp'

export interface CompressionResult {
  buffer: Buffer
  contentType: string
  extension: string
  originalSizeBytes: number
  compressedSizeBytes: number
  width?: number
  height?: number
}

/**
 * Compresses an image buffer targeting max 2048px on its longest side,
 * converted to WebP with 88% quality (preserving fine thermal receipt print,
 * small SST registration numbers, and itemized line items).
 */
export async function compressReceiptImage(
  inputBuffer: Buffer,
  maxDimension: number = 2048,
  quality: number = 88
): Promise<CompressionResult> {
  const originalSizeBytes = inputBuffer.length

  const pipeline = sharp(inputBuffer)
  const metadata = await pipeline.metadata()

  // Resize only if larger than maxDimension, keeping aspect ratio without upscaling
  pipeline.rotate() // auto-orient based on EXIF
  pipeline.resize({
    width: maxDimension,
    height: maxDimension,
    fit: 'inside',
    withoutEnlargement: true,
  })

  // Encode to WebP with high quality for text preservation
  const compressedBuffer = await pipeline
    .webp({
      quality,
      effort: 4, // balanced CPU effort vs size
      lossless: false,
    })
    .toBuffer()

  const finalMeta = await sharp(compressedBuffer).metadata()

  return {
    buffer: compressedBuffer,
    contentType: 'image/webp',
    extension: 'webp',
    originalSizeBytes,
    compressedSizeBytes: compressedBuffer.length,
    width: finalMeta.width,
    height: finalMeta.height,
  }
}
