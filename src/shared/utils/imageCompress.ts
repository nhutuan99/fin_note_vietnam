/**
 * Downscales and re-encodes an image file before it is embedded in a note as a data URL.
 * Notes are stored as a single KV value, so a raw 4 MB phone photo would bloat every save.
 */

const MAX_DIMENSION = 1600
const QUALITY = 0.85
/** Small images (icons, screenshots of a few KB) are kept untouched */
const SKIP_BELOW_BYTES = 150_000

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function compressImageFile(file: File): Promise<string> {
  const original = await readAsDataUrl(file)
  // GIFs would lose their animation; SVGs are already small and scalable
  if (file.size < SKIP_BELOW_BYTES || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return original
  }

  try {
    const img = await loadImage(original)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // WebP keeps transparency (PNG screenshots) and is much smaller; fall back to JPEG where unsupported
    let compressed = canvas.toDataURL('image/webp', QUALITY)
    if (!compressed.startsWith('data:image/webp')) compressed = canvas.toDataURL('image/jpeg', QUALITY)
    return compressed.length < original.length ? compressed : original
  } catch {
    return original
  }
}
