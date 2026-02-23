import { NextResponse } from "next/server"
import { getTelosContext } from "@/lib/telos-data"
import { spawn } from "child_process"

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // Load all TELOS context
    const telosContext = getTelosContext()

    const systemPrompt = `You are a helpful AI assistant with access to the user's complete Personal TELOS (Life Operating System).

${telosContext}

When answering questions:
- Reference specific information from the TELOS files above
- Be conversational and helpful
- If asked about goals, projects, beliefs, wisdom, etc., use the exact information from the relevant sections
- If information isn't in the TELOS data, say so clearly
- Keep responses concise but informative`

    // Use Inference tool instead of direct API
    const inferenceResult = await new Promise<{ success: boolean; output?: string; error?: string }>((resolve) => {
      const homeDir = process.env.HOME || ''
      const proc = spawn('bun', ['run', `${homeDir}/.claude/skills/PAI/Tools/Inference.ts`, '--level', 'fast', systemPrompt, message], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => { stdout += data.toString() })
      proc.stderr.on('data', (data) => { stderr += data.toString() })

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: stderr || `Process exited with code ${code}` })
        } else {
          resolve({ success: true, output: stdout.trim() })
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })

    if (!inferenceResult.success) {
      console.error("Inference Error:", inferenceResult.error)
      throw new Error(`Inference failed: ${inferenceResult.error}`)
    }

    const assistantMessage = inferenceResult.output

    if (!assistantMessage) {
      throw new Error("No response from inference")
    }

    return NextResponse.json({ response: assistantMessage })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
