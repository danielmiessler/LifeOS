import fs from 'fs'
import path from 'path'
import os from 'os'

export interface TelosFile {
  name: string
  filename: string
  content: string
  type: 'markdown' | 'csv'
}

const TELOS_DIR = path.join(os.homedir(), '.claude/PAI/USER/TELOS')

export function getAllTelosData(): TelosFile[] {
  const files: TelosFile[] = []

  try {
    // Scan for all .md files in TELOS directory
    if (fs.existsSync(TELOS_DIR)) {
      const dirFiles = fs.readdirSync(TELOS_DIR)

      for (const filename of dirFiles) {
        if (filename.endsWith('.md') && !filename.startsWith('.')) {
          try {
            const filePath = path.join(TELOS_DIR, filename)
            const stats = fs.statSync(filePath)

            if (stats.isFile()) {
              const content = fs.readFileSync(filePath, 'utf-8')
              files.push({
                name: filename.replace('.md', ''),
                filename,
                content,
                type: 'markdown',
              })
            }
          } catch (error) {
            console.error(`Error reading ${filename}:`, error)
          }
        }
      }

      // Also scan for CSV files in data subdirectory
      const dataDir = path.join(TELOS_DIR, 'data')
      if (fs.existsSync(dataDir)) {
        const csvFiles = fs.readdirSync(dataDir)

        for (const filename of csvFiles) {
          if (filename.endsWith('.csv') && !filename.startsWith('.')) {
            try {
              const filePath = path.join(dataDir, filename)
              const stats = fs.statSync(filePath)

              if (stats.isFile()) {
                const content = fs.readFileSync(filePath, 'utf-8')
                files.push({
                  name: filename.replace('.csv', ''),
                  filename: `data/${filename}`,
                  content,
                  type: 'csv',
                })
              }
            } catch (error) {
              console.error(`Error reading ${filename}:`, error)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning TELOS directory:', error)
  }

  // Sort files: put core TELOS files first, then alphabetically
  const coreFiles = ['TELOS', 'MISSION', 'BELIEFS', 'WISDOM', 'GOALS', 'PROJECTS']
  files.sort((a, b) => {
    const aIsCore = coreFiles.includes(a.name)
    const bIsCore = coreFiles.includes(b.name)

    if (aIsCore && !bIsCore) return -1
    if (!aIsCore && bIsCore) return 1
    if (aIsCore && bIsCore) {
      return coreFiles.indexOf(a.name) - coreFiles.indexOf(b.name)
    }
    return a.name.localeCompare(b.name)
  })

  return files
}

export function getTelosContext(): string {
  const files = getAllTelosData()

  let context = "# Personal TELOS (Life Operating System)\n\n"
  context += "You have access to the complete TELOS context. Use this information to answer questions about life, goals, beliefs, projects, and wisdom.\n\n"

  for (const file of files) {
    context += `\n## ${file.name}\n\n`
    context += file.content
    context += '\n\n---\n\n'
  }

  return context
}

export function getTelosFileList(): string[] {
  const files = getAllTelosData()
  return files.map(f => f.filename)
}

export function getTelosFileCount(): number {
  const files = getAllTelosData()
  return files.length
}
