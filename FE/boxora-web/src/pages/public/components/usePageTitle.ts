import { useEffect } from 'react'

const BASE_TITLE = 'Boxora'

/** Sets `document.title` to "<title> · Boxora" while the page is mounted. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = previous
    }
  }, [title])
}
