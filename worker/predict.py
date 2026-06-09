#!/usr/bin/env python3
"""
RALLY — match prediction worker (penaltyblog).

Phase D of the 10x plan (docs/HANDOFF-backend.md §2.5). Fits a Dixon-Coles
model on recent results, predicts home/draw/away probabilities for each
upcoming fixture, and upserts them into Supabase `predictions`. The app reads
them for the win-probability bar and a real Super Predictor leaderboard (it
falls back to a form-based estimate until this populates).

Data flow:
    load_results()  -> DataFrame[team_home, team_away, goals_home, goals_away]
    fit_model(df)   -> fitted penaltyblog Dixon-Coles model
    load_upcoming() -> rows from Supabase `matches` where status='pre'
    predict(clf, a, b) -> (prob_a, prob_draw, prob_b)
    upsert_predictions(rows) -> Supabase `predictions` (match_id pk)

⚠️  load_results() is a SAMPLE implementation so the script runs end-to-end.
    Swap in a real source (penaltyblog scrapers — FBref / Understat / Club Elo,
    or your own results table) where flagged. Everything else is production
    shape and needs no changes.

Run nightly (cron / Coolify scheduled task / GitHub Action):
    pip install -r requirements.txt
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python predict.py
"""
import os
from datetime import datetime, timezone

import pandas as pd
import penaltyblog as pb

MODEL_NAME = "dixon_coles"


# ---------------------------------------------------------------------------
# Data source
# ---------------------------------------------------------------------------
def load_results():
    """Return a DataFrame of recent results with the columns:
    team_home, team_away, goals_home, goals_away.

    ⚠️ SAMPLE / PLACEHOLDER. This illustrative dataset lets the worker run and
    upsert real-shaped predictions without a live data source. Replace with a
    real source. penaltyblog ships scrapers, e.g.:

        fb = pb.scrapers.FBref("ENG Premier League", "2023-2024")
        df = fb.get_fixtures()
        return df.rename(columns={
            "team_home": "team_home", "team_away": "team_away",
            "goals_home": "goals_home", "goals_away": "goals_away",
        })[["team_home", "team_away", "goals_home", "goals_away"]].dropna()

    For a World Cup model, blend recent international results (Club Elo / your
    own results table) keyed on the same team names used in `matches`.
    """
    # A handful of national-team results, just enough for Dixon-Coles to fit.
    sample = [
        ("Brazil", "Argentina", 1, 0), ("Argentina", "France", 3, 3),
        ("France", "Morocco", 2, 0), ("Morocco", "Portugal", 1, 0),
        ("Portugal", "Spain", 2, 2), ("Spain", "Germany", 1, 1),
        ("Germany", "Japan", 1, 2), ("Japan", "Croatia", 1, 1),
        ("Croatia", "Brazil", 1, 1), ("Argentina", "Netherlands", 2, 2),
        ("Netherlands", "USA", 3, 1), ("USA", "England", 0, 0),
        ("England", "France", 1, 2), ("Spain", "Croatia", 3, 0),
        ("Brazil", "South Korea", 4, 1), ("Morocco", "Spain", 0, 0),
        ("Portugal", "Switzerland", 6, 1), ("Argentina", "Mexico", 2, 0),
        ("Mexico", "Poland", 0, 0), ("Poland", "Saudi Arabia", 2, 0),
        ("France", "Denmark", 2, 1), ("Denmark", "Tunisia", 0, 0),
        ("Belgium", "Canada", 1, 0), ("Canada", "Morocco", 1, 2),
        ("Brazil", "Switzerland", 1, 0), ("Germany", "Spain", 1, 1),
        ("Netherlands", "Argentina", 2, 2), ("England", "Senegal", 3, 0),
        ("Senegal", "Ecuador", 2, 1), ("Ecuador", "Netherlands", 1, 1),
    ]
    return pd.DataFrame(
        sample, columns=["team_home", "team_away", "goals_home", "goals_away"]
    )


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------
def fit_model(results_df):
    """Fit Dixon-Coles on past results. Returns a fitted penaltyblog model."""
    clf = pb.models.DixonColesGoalModel(
        results_df["goals_home"],
        results_df["goals_away"],
        results_df["team_home"],
        results_df["team_away"],
    )
    clf.fit()
    return clf


def predict(clf, home, away):
    """Return (prob_home, prob_draw, prob_away), each in [0, 1], summing to ~1.

    Teams not present in the training data have no fitted strength; we return
    None so the caller can skip them (the UI then uses its form-based fallback).
    """
    teams = set(clf.teams) if hasattr(clf, "teams") else None
    if teams is not None and (home not in teams or away not in teams):
        return None
    probs = clf.predict(home, away)  # penaltyblog FootballProbabilityGrid
    return probs.home_win, probs.draw, probs.away_win


# ---------------------------------------------------------------------------
# Supabase I/O
# ---------------------------------------------------------------------------
def _client():
    from supabase import create_client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
            "(see ../source/.env.example)"
        )
    return create_client(url, key)


def load_upcoming_fixtures():
    """Read pre-match fixtures from Supabase `matches` (status='pre').

    Returns list of {id, team_a, team_b}. If creds are missing this raises;
    set them, or run against a stub by importing load_results only.
    """
    sb = _client()
    res = sb.table("matches").select("id, team_a, team_b").eq("status", "pre").execute()
    return res.data or []


def upsert_predictions(rows):
    """rows: [{match_id, prob_a, prob_draw, prob_b, model}]. Adds updated_at and
    upserts into `predictions` (match_id is the primary key)."""
    if not rows:
        print("no predictions to upsert")
        return
    now = datetime.now(timezone.utc).isoformat()
    payload = [{**r, "updated_at": now} for r in rows]
    sb = _client()
    sb.table("predictions").upsert(payload).execute()
    print(f"upserted {len(payload)} predictions")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main():
    print("RALLY prediction worker — fitting Dixon-Coles…")
    results = load_results()              # ⚠️ SAMPLE source — see TODO above
    clf = fit_model(results)

    fixtures = load_upcoming_fixtures()   # Supabase matches where status='pre'
    print(f"  {len(fixtures)} upcoming fixture(s)")

    rows = []
    skipped = 0
    for f in fixtures:
        out = predict(clf, f["team_a"], f["team_b"])
        if out is None:
            skipped += 1
            continue
        pa, pdraw, pb_ = out
        rows.append({
            "match_id": f["id"],
            "prob_a": float(pa),
            "prob_draw": float(pdraw),
            "prob_b": float(pb_),
            "model": MODEL_NAME,
        })

    if skipped:
        print(f"  skipped {skipped} fixture(s) with teams not in training data")
    upsert_predictions(rows)
    print("done.")


if __name__ == "__main__":
    main()
