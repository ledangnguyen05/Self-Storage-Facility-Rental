/** Largest file the backend accepts for one upload. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

/** Longest edge of an evidence photo after downscaling (keeps uploads small on phone cameras). */
const MAX_IMAGE_EDGE = 1600
const JPEG_QUALITY = 0.85
/** Photos below this size are uploaded as they are. */
const KEEP_AS_IS_BYTES = 1024 * 1024

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const DOCUMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

/** A picked file the browser can already tell is not acceptable (type, size). The message is user-facing. */
export class FileInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileInputError'
  }
}

/** Message to show for a failed pick or upload: our own checks verbatim, anything else through the API error mapper. */
export function describeUploadError(err: unknown, getApiMessage: (err: unknown) => string): string {
  return err instanceof FileInputError ? err.message : getApiMessage(err)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Không đọc được ảnh.'))
    image.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Checks a picked file and returns what should be uploaded: large phone photos are downscaled to a JPEG,
 * everything else (small images, PDFs) is sent unchanged. The result is uploaded as a real file
 * (`handoverService.uploadEvidence`); nothing is ever turned into a base64 string.
 */
export async function prepareUploadFile(file: File, options: { imagesOnly?: boolean } = {}): Promise<File> {
  if (!ALLOWED_TYPES.has(file.type) || (options.imagesOnly && file.type === 'application/pdf')) {
    throw new FileInputError(options.imagesOnly ? 'Chỉ nhận ảnh JPG, PNG hoặc WEBP.' : 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc tệp PDF.')
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new FileInputError('Tệp vượt quá 10 MB. Vui lòng chọn tệp nhỏ hơn.')
  }
  if (file.type === 'application/pdf') return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    if (scale >= 1 && file.size < KEEP_AS_IS_BYTES) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
    if (!blob || blob.size >= file.size) return file
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'anh'
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  } catch {
    // Could not decode (unusual format): let the server decide.
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function isPdfUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && /\.pdf(\?.*)?$/i.test(url)
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
