/**
 * Download Maia ONNX opset15 nets into src/engines/maia/onnx/ (gitignored).
 * Usage: pnpm fetch:maia
 *
 * Source: https://huggingface.co/cstr/maia-chess-onnx-opset15
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RATINGS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]
const BASE =
  'https://huggingface.co/cstr/maia-chess-onnx-opset15/resolve/main'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/engines/maia/onnx')

await mkdir(outDir, { recursive: true })

for (const rating of RATINGS) {
  const name = `maia-${rating}-opset15.onnx`
  const dest = join(outDir, name)
  try {
    await access(dest)
    console.log(`skip (exists) ${name}`)
    continue
  } catch {
    // download
  }
  const url = `${BASE}/${name}`
  console.log(`fetch ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`failed ${rating}: ${res.status}`)
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
  console.log(`wrote ${name} (${buf.length} bytes)`)
}

console.log('done')
