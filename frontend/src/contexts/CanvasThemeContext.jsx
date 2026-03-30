import { createContext, useContext } from 'react'

// Provides the raw dark boolean to components that drive styles via JS
// (SchemaCanvas → Background color, MiniMap maskColor;
//  CustomSchemaEdge → inline edge-label styles).
// All other designer components rely on Tailwind dark: classes activated
// by the [data-canvas-theme=dark] @variant defined in index.css.
export const CanvasThemeContext = createContext(false)
export const useCanvasTheme = () => useContext(CanvasThemeContext)
