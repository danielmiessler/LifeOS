"use client"

import { useState, useEffect } from "react"
import { useParams, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Table as TableIcon, Edit2, Save, X } from "lucide-react"
import ReactMarkdown from "react-markdown"

export default function FilePage() {
  const params = useParams()
  const slug = params.slug as string

  const [file, setFile] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    // Fetch file data
    fetch('/api/files/count')
      .then(res => res.json())
      .then(data => {
        const matchingFile = data.files.find((f: string) => {
          const fileSlug = f.replace('.md', '').replace('.csv', '').replace('data/', '')
          return fileSlug === slug
        })

        if (matchingFile) {
          // Fetch the actual file content
          fetch(`/api/file/get?filename=${encodeURIComponent(matchingFile)}`)
            .then(res => res.json())
            .then(fileData => {
              setFile({
                name: slug,
                filename: matchingFile,
                content: fileData.content,
                type: matchingFile.endsWith('.csv') ? 'csv' : 'markdown'
              })
              setEditedContent(fileData.content)
            })
        }
      })
  }, [slug])

  if (!file) {
    return <div className="p-8">Loading...</div>
  }

  const isCSV = file.type === 'csv'

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      const response = await fetch('/api/file/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.filename,
          content: editedContent,
        }),
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      file.content = editedContent
      setIsEditing(false)
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (error) {
      console.error('Error saving file:', error)
      setSaveStatus("error")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
            {isCSV ? (
              <TableIcon className="h-10 w-10 mr-3 text-[#33b579]" />
            ) : (
              <FileText className="h-10 w-10 mr-3 text-[#2e7de9]" />
            )}
            {file.name}
          </h1>
          <p className="text-lg text-gray-600">
            {file.filename}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-[#2e7de9] hover:bg-[#2e7de9]/90"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setIsEditing(false)
                  setEditedContent(file.content)
                  setSaveStatus("idle")
                }}
                variant="outline"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#33b579] hover:bg-[#33b579]/90"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {saveStatus === "success" && (
        <div className="mb-4 p-4 bg-[#33b579]/10 text-[#33b579] rounded-lg">
          File saved successfully!
        </div>
      )}

      {saveStatus === "error" && (
        <div className="mb-4 p-4 bg-[#f52a65]/10 text-[#f52a65] rounded-lg">
          Error saving file. Please try again.
        </div>
      )}

      <Card className="border-l-4 border-l-[#2e7de9]">
        <CardHeader>
          <CardTitle>Content</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-[600px] p-4 border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#2e7de9]"
            />
          ) : (
            <>
              {isCSV ? (
                <div className="overflow-x-auto">
                  <CSVTable content={file.content} />
                </div>
              ) : (
                <div className="prose max-w-none">
                  <ReactMarkdown>{file.content}</ReactMarkdown>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CSVTable({ content }: { content: string }) {
  const lines = content.trim().split('\n')
  if (lines.length === 0) return <p className="text-gray-500">Empty file</p>

  const headers = lines[0].split(',').map(h => h.trim())
  const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()))

  return (
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          {headers.map((header, idx) => (
            <th
              key={idx}
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} className="hover:bg-gray-50">
            {row.map((cell, cellIdx) => (
              <td
                key={cellIdx}
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
