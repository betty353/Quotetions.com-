"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/providers/ThemeProvider"

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  )
}
