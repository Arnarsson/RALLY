// Vercel Serverless Function — /api/sync-channels
//
// Triggered daily by Vercel Cron (repo-root vercel.json: "30 4 * * *"), 30 min
// after sync-fixtures so the matches exist before we attach Danish TV channels.
// Spawns the existing node script (owned by another agent); it matches each
// fixture to its DR/TV 2 channel by team pair and, with --target=supabase,
// writes the `matches.tv` column.
//
// SECURITY: requires `Authorization: Bearer $CRON_SECRET`.
//
// DEPLOY NOTE: vercel.json declares `includeFiles: "scripts/**"` so the script
// ships with this function. Required env: CRON_SECRET, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import { spawn } from 'node:child_process';
import path from 'node:path';

function runScript(scriptRelPath, args = []) {
  return new Promise((resolve) => {
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
      'scripts/fetch-channels.mjs',
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
