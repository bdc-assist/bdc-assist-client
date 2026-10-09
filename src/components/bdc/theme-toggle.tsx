import { MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { TooltipIconButton } from '@/components/assistant-ui/elements/tooltip-icon-button'

const KEY = 'bdc-theme' // 'dark' | 'light': the user's pick; none: follow the system

function initial(): boolean {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'dark' || saved === 'light') return saved === 'dark'
  } catch {
    // storage blocked (private window): follow the system
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Switches between light and dark (the `dark` class on <html>, see index.css).
 * Starts from the user's last pick, else the system's setting. */
export function ThemeToggle() {
  const [dark, setDark] = useState(initial)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return (
    <TooltipIconButton
      tooltip={dark ? 'Light mode' : 'Dark mode'}
      side="left"
      variant="outline"
      className="absolute top-3 right-6 z-20 size-8 rounded-full p-2"
      onClick={() => {
        setDark(!dark)
        try {
          localStorage.setItem(KEY, dark ? 'light' : 'dark')
        } catch {
          // not remembered: fine
        }
      }}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </TooltipIconButton>
  )
}
