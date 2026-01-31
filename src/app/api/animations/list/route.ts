import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public', 'animations')
    const files = fs.existsSync(publicDir)
      ? fs.readdirSync(publicDir).filter((f) => f.endsWith('.json'))
      : []

    return NextResponse.json({ files })
  } catch (error) {
    console.error('Error listing animations:', error)
    return NextResponse.json({ files: [] })
  }
}
