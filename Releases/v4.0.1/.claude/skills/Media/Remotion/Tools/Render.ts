/**
 * Remotion Code-First Interface
 *
 * TypeScript wrappers for Remotion CLI operations.
 * Enables programmatic video rendering with full control.
 */

import { $ } from 'bun'

export interface RenderOptions {
  /** Composition ID to render */
  compositionId: string
  /** Output file path */
  outputPath: string
  /** Video codec */
  codec?: 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores' | 'gif'
  /** Constant Rate Factor (quality, lower = better, 0-51) */
  crf?: number
  /** Frames per second */
  fps?: number
  /** Video width */
  width?: number
  /** Video height */
  height?: number
  /** Props to pass to composition */
  inputProps?: Record<string, any>
  /** Project directory (defaults to cwd) */
  projectDir?: string
  /** Specific frames to render (e.g., "0-100") */
  frames?: string
  /** Image sequence output format */
  imageFormat?: 'png' | 'jpeg'
  /** JPEG quality (0-100) */
  jpegQuality?: number
  /** Scale factor */
  scale?: number
  /** Mute audio */
  muted?: boolean
  /** Audio codec */
  audioCodec?: 'aac' | 'mp3' | 'opus' | 'wav' | 'pcm'
  /** Number of render threads */
  concurrency?: number
  /** Verbose output */
  verbose?: boolean
}

export interface Composition {
  id: string
  width: number
  height: number
  fps: number
  durationInFrames: number
  defaultProps?: Record<string, any>
}

export interface RenderResult {
  success: boolean
  outputPath: string
  duration?: number
  error?: string
}

/**
 * Render a Remotion composition to video file
 *
 * @param options - Render configuration
 * @returns Render result
 */
export async function render(options: RenderOptions): Promise<RenderResult> {
  const args: string[] = ['npx', 'remotion', 'render', options.compositionId, options.outputPath]

  if (options.codec) args.push('--codec', options.codec)
  if (options.crf !== undefined) args.push('--crf', String(options.crf))
  if (options.fps) args.push('--fps', String(options.fps))
  if (options.width) args.push('--width', String(options.width))
  if (options.height) args.push('--height', String(options.height))
  if (options.frames) args.push('--frames', options.frames)
  if (options.imageFormat) args.push('--image-format', options.imageFormat)
  if (options.jpegQuality) args.push('--jpeg-quality', String(options.jpegQuality))
  if (options.scale) args.push('--scale', String(options.scale))
  if (options.muted) args.push('--muted')
  if (options.audioCodec) args.push('--audio-codec', options.audioCodec)
  if (options.concurrency) args.push('--concurrency', String(options.concurrency))

  if (options.inputProps) {
    args.push('--props', JSON.stringify(options.inputProps))
  }

  const startTime = Date.now()
  const cwd = options.projectDir || process.cwd()

  try {
    const result = await $`${args}`.cwd(cwd).text()
    const duration = (Date.now() - startTime) / 1000

    return {
      success: true,
      outputPath: options.outputPath,
      duration
    }
  } catch (error: any) {
    return {
      success: false,
      outputPath: options.outputPath,
      error: error.message || String(error)
    }
  }
}

/**
 * Render a still image from a composition
 *
 * @param options - Still render configuration
 * @returns Render result
 */
export async function renderStill(options: {
  compositionId: string
  outputPath: string
  frame?: number
  inputProps?: Record<string, any>
  projectDir?: string
  imageFormat?: 'png' | 'jpeg'
  jpegQuality?: number
  scale?: number
}): Promise<RenderResult> {
  const args: string[] = ['npx', 'remotion', 'still', options.compositionId, options.outputPath]

  if (options.frame !== undefined) args.push('--frame', String(options.frame))
  if (options.imageFormat) args.push('--image-format', options.imageFormat)
  if (options.jpegQuality) args.push('--jpeg-quality', String(options.jpegQuality))
  if (options.scale) args.push('--scale', String(options.scale))

  if (options.inputProps) {
    args.push('--props', JSON.stringify(options.inputProps))
  }

  const cwd = options.projectDir || process.cwd()

  try {
    await $`${args}`.cwd(cwd).text()

    return {
      success: true,
      outputPath: options.outputPath
    }
  } catch (error: any) {
    return {
      success: false,
      outputPath: options.outputPath,
      error: error.message || String(error)
    }
  }
}

/**
 * List all compositions in a Remotion project
 *
 * @param projectDir - Project directory (defaults to cwd)
 * @returns Array of compositions
 */
export async function listCompositions(projectDir?: string): Promise<Composition[]> {
  const cwd = projectDir || process.cwd()

  try {
    const result = await $`npx remotion compositions --json`.cwd(cwd).text()
    return JSON.parse(result)
  } catch (error: any) {
    console.error('Failed to list compositions:', error.message)
    return []
  }
}

/**
 * Start the Remotion studio preview server
 *
 * @param options - Studio options
 */
export async function startStudio(options?: {
  projectDir?: string
  port?: number
  browserArgs?: string[]
}): Promise<void> {
  const args: string[] = ['npx', 'remotion', 'studio']

  if (options?.port) args.push('--port', String(options.port))

  const cwd = options?.projectDir || process.cwd()

  // Run in background - studio stays open
  $`${args}`.cwd(cwd).nothrow()

  console.log(`Remotion Studio starting at http://localhost:${options?.port || 3000}`)
}

/**
 * Create a new Remotion project
 *
 * @param options - Project creation options
 */
export async function createProject(options: {
  name: string
  template?: 'blank' | 'hello-world' | 'three' | 'audiogram' | 'tts'
  outputDir?: string
}): Promise<{ success: boolean; path: string; error?: string }> {
  const args: string[] = ['npx', 'create-video@latest', options.name]

  if (options.template) {
    args.push('--template', options.template)
  }

  const cwd = options.outputDir || process.cwd()

  try {
    await $`${args}`.cwd(cwd).text()

    return {
      success: true,
      path: `${cwd}/${options.name}`
    }
  } catch (error: any) {
    return {
      success: false,
      path: `${cwd}/${options.name}`,
      error: error.message || String(error)
    }
  }
}

/**
 * Upgrade Remotion packages in a project
 *
 * @param projectDir - Project directory
 */
export async function upgrade(projectDir?: string): Promise<{ success: boolean; error?: string }> {
  const cwd = projectDir || process.cwd()

  try {
    await $`npx remotion upgrade`.cwd(cwd).text()
    return { success: true }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || String(error)
    }
  }
}

/**
 * Get video metadata using Mediabunny
 */
export async function getVideoMetadata(videoPath: string): Promise<{
  width: number
  height: number
  durationInSeconds: number
  fps: number
} | null> {
  try {
    // This requires @remotion/media-utils in the project
    const result = await $`npx remotion parse-video ${videoPath} --json`.text()
    return JSON.parse(result)
  } catch {
    return null
  }
}

/**
 * Get audio duration using Mediabunny
 */
export async function getAudioDuration(audioPath: string): Promise<number | null> {
  try {
    const result = await $`npx remotion parse-audio ${audioPath} --json`.text()
    const data = JSON.parse(result)
    return data.durationInSeconds
  } catch {
    return null
  }
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'render': {
      const [_, compositionId, outputPath, ...rest] = args
      if (!compositionId || !outputPath) {
        console.error('Usage: bun run index.ts render <compositionId> <outputPath> [--crf N] [--fps N]')
        process.exit(1)
      }

      const options: RenderOptions = { compositionId, outputPath }

      // Parse optional args
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--crf' && rest[i + 1]) options.crf = parseInt(rest[++i])
        if (rest[i] === '--fps' && rest[i + 1]) options.fps = parseInt(rest[++i])
        if (rest[i] === '--codec' && rest[i + 1]) options.codec = rest[++i] as any
        if (rest[i] === '--width' && rest[i + 1]) options.width = parseInt(rest[++i])
        if (rest[i] === '--height' && rest[i + 1]) options.height = parseInt(rest[++i])
      }

      const result = await render(options)
      console.log(JSON.stringify(result, null, 2))
      break
    }

    case 'list': {
      const compositions = await listCompositions(args[1])
      console.log(JSON.stringify(compositions, null, 2))
      break
    }

    case 'create': {
      const name = args[1]
      const template = args[2] as any

      if (!name) {
        console.error('Usage: bun run index.ts create <name> [template]')
        process.exit(1)
      }

      const result = await createProject({ name, template })
      console.log(JSON.stringify(result, null, 2))
      break
    }

    default:
      console.log(`
Remotion CLI Wrapper

Commands:
  render <compositionId> <outputPath> [--crf N] [--fps N] [--codec TYPE]
  list [projectDir]
  create <name> [template]

Examples:
  bun run index.ts render my-video out/video.mp4 --crf 18
  bun run index.ts list
  bun run index.ts create new-project hello-world
`)
  }
}
