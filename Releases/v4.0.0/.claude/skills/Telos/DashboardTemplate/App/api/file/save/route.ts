import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'
import os from 'os'

const TELOS_DIR = path.join(os.homedir(), '.claude/skills/Telos')

export async function POST(request: Request) {
  try {
    const { filename, content } = await request.json()

    if (!filename || content === undefined) {
      return NextResponse.json(
        { error: "Filename and content are required" },
        { status: 400 }
      )
    }

    // Determine file path
    const isCSV = filename.endsWith('.csv')
    let filePath: string

    if (isCSV) {
      const csvDir = path.join(TELOS_DIR, 'data')
      filePath = path.join(csvDir, filename)
    } else {
      filePath = path.join(TELOS_DIR, filename)
    }

    // Verify file exists before overwriting
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `File ${filename} does not exist` },
        { status: 404 }
      )
    }

    // Save file
    fs.writeFileSync(filePath, content, 'utf-8')

    // Log the edit
    const timestamp = new Date().toISOString()
    const logMessage = `\n## ${timestamp}\n\n- **Action:** File edited via dashboard\n- **File:** ${filename}\n`

    const updatesPath = path.join(TELOS_DIR, 'updates.md')
    if (fs.existsSync(updatesPath)) {
      fs.appendFileSync(updatesPath, logMessage)
    }

    return NextResponse.json({
      success: true,
      message: `${filename} saved successfully`,
    })
  } catch (error) {
    console.error("Error saving file:", error)
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    )
  }
}
