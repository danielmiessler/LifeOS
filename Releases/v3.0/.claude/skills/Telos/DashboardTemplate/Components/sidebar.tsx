"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, MessageSquare, Upload, FileText, Table } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"

interface FileNav {
  name: string
  slug: string
  href: string
  isCSV: boolean
}

const staticNavigation = [
  { name: "Overview", href: "/", icon: Home },
  { name: "Ask", href: "/ask", icon: MessageSquare },
  { name: "Add File", href: "/add-file", icon: Upload },
]

export function Sidebar() {
  const pathname = usePathname()
  const [fileCount, setFileCount] = useState(0)
  const [files, setFiles] = useState<string[]>([])
  const [fileNavigation, setFileNavigation] = useState<FileNav[]>([])

  const fetchFileCount = () => {
    fetch('/api/files/count')
      .then(res => res.json())
      .then(data => {
        setFileCount(data.count)
        setFiles(data.files)

        // Build file navigation
        const navItems: FileNav[] = data.files.map((filename: string) => {
          const isCSV = filename.endsWith('.csv')
          const slug = filename.replace('.md', '').replace('.csv', '').replace('data/', '')
          return {
            name: slug,
            slug,
            href: `/file/${slug}`,
            isCSV
          }
        })
        setFileNavigation(navItems)
      })
      .catch(err => console.error('Failed to fetch file count:', err))
  }

  useEffect(() => {
    // Initial fetch
    fetchFileCount()

    // Listen for file upload events
    const handleFileUploaded = () => {
      fetchFileCount()
    }

    window.addEventListener('telosFileUploaded', handleFileUploaded)

    return () => {
      window.removeEventListener('telosFileUploaded', handleFileUploaded)
    }
  }, [])

  return (
    <div className="flex h-screen w-64 flex-col fixed left-0 top-0 bg-gradient-to-b from-[#2e7de9]/5 to-[#9854f1]/5 border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#2e7de9] to-[#9854f1] bg-clip-text text-transparent">
          Personal TELOS
        </h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {/* Static Navigation */}
        {staticNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all",
                isActive
                  ? "bg-[#2e7de9] text-white shadow-lg shadow-[#2e7de9]/20"
                  : "text-gray-700 hover:bg-white hover:text-[#2e7de9] hover:shadow-sm"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                  isActive ? "text-white" : "text-gray-500 group-hover:text-[#2e7de9]"
                )}
              />
              {item.name}
            </Link>
          )
        })}

        {/* Divider */}
        {fileNavigation.length > 0 && (
          <div className="border-t my-2 pt-2">
            <div className="text-xs font-semibold text-gray-500 px-3 mb-2 flex items-center justify-between">
              <span>TELOS FILES</span>
              <Badge variant="secondary" className="bg-gray-200 text-gray-700 text-[10px]">
                {fileCount}
              </Badge>
            </div>
          </div>
        )}

        {/* Dynamic File Navigation */}
        {fileNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.slug}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all",
                isActive
                  ? "bg-[#2e7de9] text-white shadow-lg shadow-[#2e7de9]/20"
                  : "text-gray-700 hover:bg-white hover:text-[#2e7de9] hover:shadow-sm"
              )}
            >
              {item.isCSV ? (
                <Table
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-[#33b579] group-hover:text-[#2e7de9]"
                  )}
                />
              ) : (
                <FileText
                  className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-colors",
                    isActive ? "text-white" : "text-[#2e7de9] group-hover:text-[#2e7de9]"
                  )}
                />
              )}
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <div className="text-xs text-gray-500 text-center">
          Personal Life Operating System
          <div className="mt-1 font-semibold text-[#2e7de9]">v1.0</div>
        </div>
      </div>
    </div>
  )
}
