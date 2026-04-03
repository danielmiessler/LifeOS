import { NextResponse } from "next/server"
import { getTelosFileCount, getTelosFileList } from "@/lib/telos-data"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const count = getTelosFileCount()
    const files = getTelosFileList()

    return NextResponse.json({
      count,
      files,
    })
  } catch (error) {
    console.error("Error getting file count:", error)
    return NextResponse.json(
      { error: "Failed to get file count" },
      { status: 500 }
    )
  }
}
