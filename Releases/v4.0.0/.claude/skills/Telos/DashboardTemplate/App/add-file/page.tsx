"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Table, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface UploadedFile {
  name: string
  type: string
  status: "success" | "error" | "uploading"
  message?: string
}

export default function AddFilePage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    await processFiles(files)
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    await processFiles(files)
  }

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      // Validate file type
      if (!file.name.endsWith('.md') && !file.name.endsWith('.csv')) {
        setUploadedFiles(prev => [...prev, {
          name: file.name,
          type: file.name.split('.').pop() || '',
          status: "error",
          message: "Only .md and .csv files are allowed"
        }])
        continue
      }

      // Add uploading status
      setUploadedFiles(prev => [...prev, {
        name: file.name,
        type: file.name.split('.').pop() || '',
        status: "uploading"
      }])

      // Upload file
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Upload failed')
        }

        const data = await response.json()

        // Update status to success
        setUploadedFiles(prev => prev.map(f =>
          f.name === file.name && f.status === "uploading"
            ? { ...f, status: "success" as const, message: data.message }
            : f
        ))

        // Trigger a custom event to notify sidebar to refresh
        window.dispatchEvent(new CustomEvent('telosFileUploaded', { detail: { filename: file.name } }))
      } catch (error) {
        // Update status to error
        setUploadedFiles(prev => prev.map(f =>
          f.name === file.name && f.status === "uploading"
            ? { ...f, status: "error" as const, message: "Upload failed" }
            : f
        ))
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
          <Upload className="h-10 w-10 mr-3 text-[#2e7de9]" />
          Add File
        </h1>
        <p className="text-lg text-gray-600">
          Upload .md or .csv files to add them to your TELOS dashboard
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Upload Area */}
        <Card className="border-l-4 border-l-[#2e7de9]">
          <CardHeader>
            <CardTitle>Upload Files</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-all
                ${isDragging
                  ? 'border-[#2e7de9] bg-[#2e7de9]/5'
                  : 'border-gray-300 hover:border-[#2e7de9] hover:bg-gray-50'
                }
              `}
            >
              <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drag and drop files here
              </p>
              <p className="text-sm text-gray-500 mb-4">
                or click to browse
              </p>
              <input
                type="file"
                id="file-upload"
                multiple
                accept=".md,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-6 py-3 bg-[#2e7de9] text-white rounded-lg hover:bg-[#2e7de9]/90 cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </label>
              <p className="text-xs text-gray-500 mt-4">
                Supported formats: .md (Markdown), .csv (Comma-separated values)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload History */}
        {uploadedFiles.length > 0 && (
          <Card className="border-l-4 border-l-[#9854f1]">
            <CardHeader>
              <CardTitle>Upload History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {file.type === 'md' ? (
                        <FileText className="h-8 w-8 text-[#2e7de9]" />
                      ) : (
                        <Table className="h-8 w-8 text-[#33b579]" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        {file.message && (
                          <p className="text-sm text-gray-600">{file.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          file.status === "success"
                            ? "default"
                            : file.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                        className={
                          file.status === "success"
                            ? "bg-[#33b579]"
                            : file.status === "uploading"
                            ? "bg-gray-500"
                            : ""
                        }
                      >
                        {file.type.toUpperCase()}
                      </Badge>
                      {file.status === "success" && (
                        <CheckCircle className="h-6 w-6 text-[#33b579]" />
                      )}
                      {file.status === "error" && (
                        <XCircle className="h-6 w-6 text-[#f52a65]" />
                      )}
                      {file.status === "uploading" && (
                        <Loader2 className="h-6 w-6 text-[#2e7de9] animate-spin" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2e7de9] text-white flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Upload Your Files</p>
                  <p>Drag and drop or click to select .md or .csv files from your computer</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2e7de9] text-white flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Automatic Analysis</p>
                  <p>Files are automatically analyzed and their content is incorporated into the TELOS system</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2e7de9] text-white flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Dashboard Updates</p>
                  <p>New data becomes immediately available in the dashboard and AI chat</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2e7de9] text-white flex items-center justify-center text-xs font-bold">
                  4
                </div>
                <div>
                  <p className="font-medium text-gray-900">Persistent Storage</p>
                  <p>Files are saved to your TELOS directory (~/.claude/skills/Telos/)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
