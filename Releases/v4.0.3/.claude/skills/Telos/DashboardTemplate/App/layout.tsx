import type { Metadata } from "next"
import "./globals.css"
import { Sidebar } from "../components/sidebar"

export const metadata: Metadata = {
  title: "TELOS Dashboard Template",
  description: "Customizable dashboard template with Tokyo Night Day theme",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.Node
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <Sidebar />
        <main className="pl-64">
          <div className="min-h-screen">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}
