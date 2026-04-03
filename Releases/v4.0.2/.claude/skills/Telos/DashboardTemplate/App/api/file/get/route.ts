import { NextResponse } from "next/server"
import { getAllTelosData } from "@/lib/telos-data"

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get('filename')

    if (!filename) {
      return NextResponse.json(
        { error: "Filename parameter is required" },
        { status: 400 }
      )
    }

    // Get all TELOS files
    const files = getAllTelosData()

    // Find the matching file
    const file = files.find(f => f.filename === filename)

    if (!file) {
      return NextResponse.json(
        { error: `File ${filename} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      content: file.content,
      type: file.type,
      name: file.name,
      filename: file.filename
    })
  } catch (error) {
    console.error("Error fetching file:", error)
    return NextResponse.json(
      { error: "Failed to fetch file" },
      { status: 500 }
    )
  }
}
