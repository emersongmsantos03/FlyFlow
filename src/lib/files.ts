export type FilePreviewMode = 'image' | 'pdf' | 'link'

export const openUrlInNewTab = (url: string) => {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export const downloadUrl = (url: string, filename: string) => {
  if (!url) return
  const link = document.createElement('a')
  link.href = url
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
