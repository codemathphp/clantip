import { NextResponse } from 'next/server'

async function fetchNoembed(url: string) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const json = await res.json()
    return {
      thumbnail: json.thumbnail_url || null,
      platform: json.provider_name || null,
    }
  } catch (e) {
    return null
  }
}

async function fetchOgImage(url: string) {
  try {
    const res = await fetch(url, { method: 'GET' })
    if (!res.ok) return null
    const text = await res.text()
    const ogMatch = text.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    if (ogMatch && ogMatch[1]) return ogMatch[1]
    const twitterMatch = text.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    if (twitterMatch && twitterMatch[1]) return twitterMatch[1]
    return null
  } catch (e) {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

    // Try noembed first (covers YouTube, Vimeo, Twitch, etc.)
    const noembed = await fetchNoembed(url)
    if (noembed && (noembed.thumbnail || noembed.platform)) {
      return NextResponse.json({ thumbnail: noembed.thumbnail, platform: noembed.platform || null })
    }

    // YouTube direct thumbnail detection
    const ytMatch = url.match(/(?:v=|youtu\.be\/|v\/|embed\/)([A-Za-z0-9_-]{6,})/i)
    if (ytMatch && ytMatch[1]) {
      const id = ytMatch[1]
      const thumb = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
      return NextResponse.json({ thumbnail: thumb, platform: 'YouTube' })
    }

    // Fallback: fetch og:image from the page
    const og = await fetchOgImage(url)
    if (og) return NextResponse.json({ thumbnail: og, platform: null })

    return NextResponse.json({ thumbnail: null, platform: null })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 })
  }
}
