import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "TELOS Strategic Report",
  description: "McKinsey-style consulting report generated from TELOS analysis",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="bg-white antialiased">
        {children}
      </body>
    </html>
  )
}
