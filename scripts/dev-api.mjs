/* =============================================================================
 * Start the CYBERSURE conversion API.
 *
 * Wraps uvicorn so the two things that reliably go wrong are handled here:
 *
 *   1. `PYTHONPATH` - `app.main` is a package-relative import, so `backend/`
 *      must be importable. Set it explicitly instead of relying on the cwd.
 *   2. `--reload-dir app` - when reload is on, the reloader watches its working
 *      directory by default, so a log file written into `backend/` becomes a
 *      watched file and restarts the server on every request, until it dies.
 *
 * Reload is opt-in (`--reload`). Auto-reload depends on filesystem-watch events
 * that are not delivered reliably on every platform - in some sandboxed and
 * containerised environments edits inside `app/` are silently missed, which
 * leaves you running stale code. The default is therefore a plain start, which
 * always reflects the code on disk. Restart after a backend edit.
 *
 * Usage:  node scripts/dev-api.mjs [--port 8000] [--reload]
 * ========================================================================== */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, '..', 'backend');

const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const PORT = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT ?? '8000';
// Reload is opt-in: filesystem-watch events are not delivered everywhere, and a
// silently-missed reload means running code that no longer matches the disk.
const RELOAD = args.includes('--reload');

if (!existsSync(join(backendDir, 'app', 'main.py'))) {
  console.error(`Cannot find backend/app/main.py under ${backendDir}`);
  process.exit(1);
}

/** Picks a working interpreter, preferring one that actually has uvicorn. */
function findPython() {
  const candidates = [
    { cmd: 'python', args: [] },
    { cmd: 'py', args: ['-3.11'] },
    { cmd: 'py', args: ['-3'] },
    { cmd: 'python3', args: [] },
  ];
  // No spaces in the probe, and no `shell: true`: passing args through a shell
  // strips the quotes around a `-c` argument and emits a security warning.
  const probeCode = "__import__('uvicorn')";
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.cmd, [...candidate.args, '-c', probeCode], {
      stdio: 'ignore',
      windowsHide: true,
    });
    if (probe.status === 0) return candidate;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error('No Python with uvicorn installed was found.');
  console.error('');
  console.error('Install the backend dependencies first:');
  console.error('  cd backend && python -m pip install -r requirements.txt');
  process.exit(1);
}

const uvicornArgs = [
  ...python.args,
  '-m',
  'uvicorn',
  'app.main:app',
  '--port',
  String(PORT),
  ...(RELOAD ? ['--reload', '--reload-dir', 'app'] : []),
];

console.log(`CYBERSURE conversion API -> http://localhost:${PORT}`);
console.log(`  cwd      ${backendDir}`);
console.log(`  reload   ${RELOAD ? 'on (watching app/ only)' : 'off - restart after backend edits'}`);
console.log(`  health   http://localhost:${PORT}/api/v1/health`);
console.log('');

const child = spawn(python.cmd, uvicornArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  windowsHide: true,
  env: {
    ...process.env,
    PYTHONPATH: backendDir,
    // Keep the reloader from picking up stray reload directories.
    PYTHONUNBUFFERED: '1',
  },
});

const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
