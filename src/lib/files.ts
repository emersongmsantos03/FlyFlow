export type FilePreviewMode = 'image' | 'pdf' | 'link'

const objectUrlForDataUrl = (url: string) => {
  if (!url.startsWith('data:')) return null

  const separator = url.indexOf(',')
  if (separator < 0) return null

  const metadata = url.slice(5, separator)
  const encoded = url.slice(separator + 1)
  const isBase64 = metadata.includes(';base64')
  const mimeType = metadata.split(';')[0] || 'application/octet-stream'
  const contents = isBase64 ? atob(encoded) : decodeURIComponent(encoded)
  const bytes = new Uint8Array(contents.length)

  for (let index = 0; index < contents.length; index += 1) bytes[index] = contents.charCodeAt(index)

  return URL.createObjectURL(new Blob([bytes], { type: mimeType }))
}

export const getBrowserSafeFileUrl = (url: string) => {
  const objectUrl = objectUrlForDataUrl(url)
  if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  return objectUrl || url
}

export const openUrlInNewTab = (url: string) => {
  if (!url) return
  const link = document.createElement('a')
  link.href = getBrowserSafeFileUrl(url)
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const downloadUrl = (url: string, filename: string) => {
  if (!url) return
  const link = document.createElement('a')
  link.href = getBrowserSafeFileUrl(url)
  link.download = filename || 'arquivo'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export const getFilePreviewMode = (url: string, fileType = ''): FilePreviewMode => {
  const normalizedUrl = url.toLowerCase()
  const normalizedType = fileType.toLowerCase()

  if (normalizedType.includes('pdf') || normalizedUrl.includes('application/pdf') || normalizedUrl.endsWith('.pdf')) {
    return 'pdf'
  }

  if (
    normalizedType.includes('image') ||
    normalizedUrl.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(normalizedUrl)
  ) {
    return 'image'
  }

  return 'link'
}
