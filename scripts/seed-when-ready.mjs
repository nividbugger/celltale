import { createConnection } from 'net'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function waitForPort(port, host = '127.0.0.1', timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const sock = createConnection(port, host)
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${host}:${port}`))
        } else {
          setTimeout(attempt, 1500)
        }
      })
    }
    attempt()
  })
}

console.log('[seed] Waiting for Auth emulator on port 9099...')
await waitForPort(9099)
console.log('[seed] Emulators ready — running seed...')

const seed = spawn('npm', ['run', 'seed'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
})

const code = await new Promise((resolve) => seed.on('close', resolve))
if (code !== 0) {
  console.error(`[seed] Seed script exited with code ${code}`)
  process.exit(code)
}
console.log('[seed] Done. Admin login: admin@celltale.dev / admin123')
