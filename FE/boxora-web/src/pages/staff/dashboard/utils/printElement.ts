const STYLESHEET_TIMEOUT_MS = 2000
const IMAGE_TIMEOUT_MS = 4000
const CLEANUP_FALLBACK_MS = 5 * 60 * 1000

function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve()
    link.addEventListener('load', done, { once: true })
    link.addEventListener('error', done, { once: true })
    window.setTimeout(done, STYLESHEET_TIMEOUT_MS)
  })
}

/** Evidence photos come from short-lived signed links: wait for them so they are on the page when it prints. */
function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    image.addEventListener('load', done, { once: true })
    image.addEventListener('error', done, { once: true })
    window.setTimeout(done, IMAGE_TIMEOUT_MS)
  })
}

/**
 * Prints only `element`: it is copied (with the app stylesheets, light theme)
 * into a hidden iframe so the rest of the page never reaches the printer.
 * Resolves false when the browser does not allow it.
 */
export async function printElement(element: HTMLElement, title: string): Promise<boolean> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)

  const frameWindow = iframe.contentWindow
  const frameDocument = iframe.contentDocument
  if (!frameWindow || !frameDocument) {
    iframe.remove()
    return false
  }

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    iframe.remove()
  }

  frameDocument.title = title
  frameDocument.documentElement.lang = document.documentElement.lang || 'vi'
  const pending: Promise<void>[] = []
  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach((node) => {
    const copy = frameDocument.importNode(node, true)
    frameDocument.head.appendChild(copy)
    if (copy.nodeName === 'LINK') pending.push(waitForStylesheet(copy as HTMLLinkElement))
  })
  frameDocument.body.className = 'bg-surface p-8 text-fg'
  frameDocument.body.appendChild(frameDocument.importNode(element, true))

  Array.from(frameDocument.images).forEach((image) => pending.push(waitForImage(image)))
  await Promise.all(pending)
  if (!iframe.isConnected) return false

  frameWindow.addEventListener('afterprint', cleanup, { once: true })
  window.setTimeout(cleanup, CLEANUP_FALLBACK_MS)
  try {
    frameWindow.focus()
    frameWindow.print()
    return true
  } catch {
    cleanup()
    return false
  }
}
