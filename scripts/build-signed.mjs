#!/usr/bin/env node
/**
 * Build the macOS app with the best signing identity this machine has.
 *
 *   source ~/.config/matchmii/apple.env && npm run build:signed
 *
 * Three rungs, in order:
 *
 *   Developer ID Application  — signs *and* notarises. The only combination
 *                               that opens on someone else's Mac without them
 *                               being told the app is damaged.
 *   Apple Development         — a real signature with a stable identity, good
 *                               on this machine. Gatekeeper still stops it
 *                               elsewhere, and notarisation refuses it.
 *   ad-hoc ("-")              — what `tauri.conf.json` falls back to. Enough
 *                               for the notification centre to register the
 *                               app, which an unsigned bundle is not.
 *
 * The rung is reported before the build starts, so a release never quietly
 * goes out one step below what was intended.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8' })

function identities() {
  // Every keychain in the search list, so the one `macos-signing.mjs` makes
  // counts without having to name it here
  try {
    return sh('security', ['find-identity', '-v', '-p', 'codesigning'])
  } catch {
    return ''
  }
}

const found = identities()
const pick = (needle) => found.split('\n').find((l) => l.includes(needle))?.match(/"(.+)"/)?.[1]

const developerId = pick('Developer ID Application')
const development = pick('Apple Development')

const env = { ...process.env }
let rung

if (developerId) {
  rung = `Developer ID — ${developerId}`
  env.APPLE_SIGNING_IDENTITY = developerId

  // Notarisation credentials, named the way the Tauri bundler expects them.
  // The App Store Connect key doubles as the notarytool key.
  const keyPath = process.env.ASC_KEY_PATH?.replace('$HOME', homedir())
  if (keyPath && existsSync(keyPath) && process.env.ASC_KEY_ID && process.env.ASC_ISSUER_ID) {
    env.APPLE_API_KEY = process.env.ASC_KEY_ID
    env.APPLE_API_ISSUER = process.env.ASC_ISSUER_ID
    env.APPLE_API_KEY_PATH = keyPath
    rung += ' + notarisation'
  } else {
    rung += ' (not notarised — source ~/.config/matchmii/apple.env for that)'
  }
} else if (development) {
  rung = `Apple Development — ${development}`
  env.APPLE_SIGNING_IDENTITY = development
} else {
  rung = 'ad-hoc — no signing identity on this machine'
  console.log('  run `node scripts/macos-signing.mjs` to set up a Developer ID')
}

console.log(`→ signing: ${rung}\n`)

// The identity has to reach the bundler through the config as well: an
// `APPLE_SIGNING_IDENTITY` in the environment does not override a
// `signingIdentity` already written there, and the config's is "-".
const args = ['run', 'tauri', 'build']
if (env.APPLE_SIGNING_IDENTITY) {
  args.push('--', '--config', JSON.stringify({
    bundle: { macOS: { signingIdentity: env.APPLE_SIGNING_IDENTITY } },
  }))
}

const result = spawnSync('npm', args, { stdio: 'inherit', env })
process.exit(result.status ?? 1)
