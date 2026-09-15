import { spawn } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'

const TEMP_DIRECTORY = path.resolve('temp')
const MAX_ANIMATED_STICKER_BYTES = 950 * 1024

function runFfmpeg(argumentsList) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath, argumentsList, { windowsHide: true })
    let errorOutput = ''
    process.stderr.on('data', (chunk) => { errorOutput += chunk })
    process.on('error', reject)
    process.on('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`FFmpeg terminou com código ${code}: ${errorOutput}`))
    })
  })
}

async function imageToSticker(buffer) {
  return sharp(buffer, { animated: true, failOn: 'none' })
    .rotate()
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({ quality: 88, effort: 4 })
    .toBuffer()
}

async function animatedToSticker(buffer, extension = 'media') {
  await mkdir(TEMP_DIRECTORY, { recursive: true })
  const id = randomUUID()
  const input = path.join(TEMP_DIRECTORY, `${id}.${extension}`)
  const output = path.join(TEMP_DIRECTORY, `${id}.webp`)

  try {
    await writeFile(input, buffer)
    // WhatsApp accepts short animated WebP stickers. Limit to 10 seconds and 15 fps.
    const filter = 'fps=15,scale=512:512:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000'
    for (const quality of [55, 45, 35, 28]) {
      await runFfmpeg([
        '-y', '-i', input, '-t', '10', '-vf', filter,
        '-c:v', 'libwebp', '-lossless', '0', '-q:v', String(quality),
        '-compression_level', '6', '-loop', '0', '-an', output
      ])
      const sticker = await readFile(output)
      if (sticker.length <= MAX_ANIMATED_STICKER_BYTES || quality === 28) return sticker
    }
  } finally {
    await Promise.allSettled([rm(input, { force: true }), rm(output, { force: true })])
  }
}

/** Converts a downloaded WhatsApp media buffer to WebP without EXIF metadata. */
export async function createSticker(buffer, mediaType, mimetype = '') {
  if (mediaType === 'image' && mimetype !== 'image/gif') return imageToSticker(buffer)
  const extension = mimetype.includes('gif') ? 'gif' : 'mp4'
  return animatedToSticker(buffer, extension)
}
