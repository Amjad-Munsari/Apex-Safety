"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Theme is no longer toggled globally — each surface (admin / client) declares
// its own theme via `data-surface` on the layout wrapper. This provider is kept
// only so any descendant calls to `useTheme()` continue to resolve, but it does
// not paint the document or attach hotkeys.
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
