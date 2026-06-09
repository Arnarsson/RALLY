// Vercel Serverless Function — /api/sync-predictions
//
// Triggered nightly by Vercel Cron (repo-root vercel.json: "0 3 * * *").
// Runs the penaltyblog prediction worker (worker/predict.py), which fits a
// Dixon-Coles / Bivariate-Poisson model and upserts prob_a/draw/b into the
// Supabase `predictions` table. The UI's win-prob bar reads from there (falling
// back to a form-based estimate until it's populated).
//
// SECURITY: requires `Authorization: Bearer $CRON_SECRET`.
//
// ⚠️ RUNTIME CAVEAT — read before relying on this on Vercel:
//   1. Python is NOT available in the default Node serverless runtime. Spawning
//      `python` here only works if a Python runtime/layer is present. The
//      simplest production path (and what HANDOFF-backend.md §2.5 recommends) is
//      to run predict.py on the OFF-VERCEL host (Fly.io / Railway / a cron box)
//      and have THIS endpoint either (a) be removed, or (b) trigger that remote
//      job via an HTTP call. We keep the endpoint so the cron wiring is complete
//      and swappable.
//   2. worker/predict.py lives at the REPO ROOT, one level ABOVE the Vercel
//      project root (`source`). includeFiles cannot reach outside the project
//      root, so the script is not bundled with this function as-is. To run it on
//      Vercel you'd need to either move worker/ under source/ or vendor it in.
//      The PYTHON_WORKER_URL path below avoids that entirely.
//
// Behaviour: if PYTHON_WORKER_URL is set we POST to the remote worker (preferred,
// runtime-agnostic). Otherwise we attempt to spawn python locally (best-effort).

import { spawn } from 'node:child_process';
import path from 'node:path';

function runCmd(cmd, args = [], cwd = process.cwd()) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env: process.env, cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: stderr + '\n' + err.message });
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
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

  // Preferred: hand off to a remote Python worker (Fly/Railway/cron box).
  const remote = process.env.PYTHON_WORKER_URL;
  if (remote) {
    try {
      const r = await fetch(remote, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
      });
      const body = await r.text();
      if (!r.ok) {
        return res.status(500).json({
          ok: false, ranAt, error: `remote worker ${r.status}`, output: tail(body),
        });
      }
      return res.status(200).json({ ok: true, ranAt, via: 'remote', output: tail(body) });
    } catch (err) {
      return res.status(500).json({ ok: false, ranAt, error: err.message });
    }
  }

  // Fallback: try spawning python locally. Requires a Python runtime on the host
  // and worker/predict.py to be reachable (see RUNTIME CAVEAT above).
  try {
    const scriptPath = path.join(process.cwd(), '..', 'worker', 'predict.py');
    const { code, stdout, stderr } = await runCmd('python', [scriptPath]);
    if (code !== 0) {
      return res.status(500).json({
        ok: false,
        ranAt,
        code,
        error: 'predict.py exited non-zero (is python available? prefer PYTHON_WORKER_URL)',
        output: tail(stderr || stdout),
      });
    }
    return res.status(200).json({ ok: true, ranAt, via: 'local', output: tail(stdout) });
  } catch (err) {
    return res.status(500).json({ ok: false, ranAt, error: err.message });
  }
}
