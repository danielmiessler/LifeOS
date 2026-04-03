import { NextResponse } from "next/server"
import fs from 'fs'
import path from 'path'
import os from 'os'

const TELOS_DIR = path.join(os.homedir(), '.claude/skills/Telos')

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name
    const isMarkdown = fileName.endsWith('.md')
    const isCSV = fileName.endsWith('.csv')

    if (!isMarkdown && !isCSV) {
      return NextResponse.json(
        { error: "Only .md and .csv files are allowed" },
        { status: 400 }
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Ensure TELOS directory exists
    if (!fs.existsSync(TELOS_DIR)) {
      fs.mkdirSync(TELOS_DIR, { recursive: true })
    }

    // Determine save path
    let savePath: string
    if (isCSV) {
      // CSV files go in data subdirectory
      const csvDir = path.join(TELOS_DIR, 'data')
      if (!fs.existsSync(csvDir)) {
        fs.mkdirSync(csvDir, { recursive: true })
      }
      savePath = path.join(csvDir, fileName)
    } else {
      // MD files go in root TELOS directory
      savePath = path.join(TELOS_DIR, fileName)
    }

    // Check if file already exists
    if (fs.existsSync(savePath)) {
      return NextResponse.json(
        { error: `File ${fileName} already exists. Please delete the existing file first or rename your file.` },
        { status: 409 }
      )
    }

    // Save file
    fs.writeFileSync(savePath, buffer)

    // Log the upload
    const timestamp = new Date().toISOString()
    const logMessage = `\n## ${timestamp}\n\n- **Action:** File uploaded via dashboard\n- **File:** ${fileName}\n- **Type:** ${isCSV ? 'CSV' : 'Markdown'}\n- **Path:** ${savePath}\n`

    const updatesPath = path.join(TELOS_DIR, 'updates.md')
    if (fs.existsSync(updatesPath)) {
      fs.appendFileSync(updatesPath, logMessage)
    }

    return NextResponse.json({
      success: true,
      message: `${fileName} uploaded successfully to ${isCSV ? 'data/' : ''}`,
      path: savePath,
    })
  } catch (error) {
    console.error("Error in upload API:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}
