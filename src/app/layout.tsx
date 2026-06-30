import type { Metadata } from "next"
import AppProviders from "@/components/providers/AppProviders"
import "./globals.css"

export const metadata: Metadata = {
  title: "Astro city crm - Enterprise Quotation Management",
  description: "Professional quotation, sales follow-up & receipt management platform for modern businesses",
  keywords: "quotation, sales, CRM, receipt, invoice, business management",
  authors: [{ name: "Astro city crm" }],
  creator: "Astro city crm",
  icons: {
    icon: "/logo.jpg",
    shortcut: "/logo.jpg",
    apple: "/logo.jpg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://quotetion.vercel.app",
    title: "Astro city crm",
    description: "Enterprise Quotation Management Platform",
    images: ["/logo.jpg"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
