'use client'

import { IconContext } from '@phosphor-icons/react'

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider value={{ size: 20, weight: 'regular' }}>
      {children}
    </IconContext.Provider>
  )
}
