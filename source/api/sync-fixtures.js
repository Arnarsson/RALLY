// Vercel Serverless Function — /api/sync-fixtures
//
// Triggered daily by Vercel Cron (see repo-root vercel.json: "0 4 * * *").
// Wraps the schedule worker by spawning the existing node script so this
// endpoint stays decoupled from the script's internals (another agent owns
// scripts/fetch-fixtures.mjs). The script already supports --target=supabase,
// upserting into the `matches` table with the service-role key.
//
// SECURITY: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. We reject
// any request without it so this can't be hit publicly.
//
// DEPLOY NOTE: the spawned script (scripts/fetch-fixtures.mjs) must be bundled
// into the function. vercel.json declares `includeFiles: "scripts/**"` for this
// function so the file ships alongside it. Required env (Vercel project):
// CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_TOKEN.

import { spawn } from 'node:child_process';
import path from 'node:path';

function runScript(scriptRelPath, args = []) {
  return new Promise((resolve) => {
    // process.cwd() is the project root (`source`) at runtime on Vercel.
    const scriptPath = path.join(process.cwd(), scriptRelPath);
    const child = spawn('node', [scriptPath, ...args], {
      env: process.env,
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function tail(str, lines = 40) {
  return (str || '').split('\n').slice(-lines).join('\n').trim();
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers['authorization'] || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const ranAt = new Date().toISOString();
  try {
    const { code, stdout, stderr } = await runScript(
      'scripts/fetch-fixtures.mjs',
      ['--target=supabase'],
    );
    if (code !== 0) {
      return res.status(500).json({
        ok: false,
        ranAt,
        code,
        error: 'worker exited non-zero',
        output: tail(stderr || stdout),
      });
    }
    return res.status(200).json({ ok: true, ranAt, output: tail(stdout) });
  } catch (err) {
    return res.status(500).json({ ok: false, ranAt, error: err.message });
  }
}
