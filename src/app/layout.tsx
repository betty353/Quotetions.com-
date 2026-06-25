import type { Metadata } from "next"
import AppProviders from "@/components/providers/AppProviders"
import "./globals.css"

export const metadata: Metadata = {
  title: "Quotely CRM - Enterprise Quotation Management",
  description: "Professional quotation, sales follow-up & receipt management platform for modern businesses",
  keywords: "quotation, sales, CRM, receipt, invoice, business management",
  authors: [{ name: "Quotely" }],
  creator: "Quotely",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://quotely.com",
    title: "Quotely CRM",
    description: "Enterprise Quotation Management Platform",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  )
}
