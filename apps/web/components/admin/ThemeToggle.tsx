'use client'

import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Theme is only known client-side; render a stable icon until mounted.
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isLight = mounted && resolvedTheme === 'light'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      onClick={() => setTheme(isLight ? 'dark' : 'light')}
    >
      {isLight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  )
}
