import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Stamp the build with the git commit so the dashboard can show which
// frontend is actually deployed (dist/ is gitignored and built on the Pi).
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

const status = git('status --porcelain')
const appVersion = {
  sha: git('rev-parse --short HEAD') || 'unknown',
  dirty: status === null ? false : status.length > 0,
  commitDate: git('log -1 --format=%cI') || 'unknown',
  builtAt: new Date().toISOString(),
}

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
