import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(new URL('..', import.meta.url).pathname)
const SRC = resolve(ROOT, 'build/icon.svg')
const OUT = resolve(ROOT, 'build/icon.png')

const svg = await readFile(SRC)
const buf = await sharp(svg, { density: 384 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9 })
  .toBuffer()
await writeFile(OUT, buf)
console.log(`wrote ${OUT} (${buf.length} bytes)`)
