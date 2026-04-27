'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--surface-2)',
          '--normal-text': 'var(--fg-2)',
          '--normal-border': 'var(--border-2)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
