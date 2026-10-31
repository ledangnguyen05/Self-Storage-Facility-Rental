import React from 'react'

/**
 * Renders the native CSS and SVG Boxora artwork.
 * The previous WebM video overlay was removed because the recorded video asset
 * accidentally captured the hero text and buttons, causing a visual duplication glitch.
 */
export const HeroArtVideo: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>
}

