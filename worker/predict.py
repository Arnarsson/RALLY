#!/usr/bin/env python3
"""
RALLY — match prediction worker (penaltyblog).

Phase D of the 10x plan. Fits a Dixon-Coles model on recent results, predicts
home/draw/away probabilities for each upcoming World Cup fixture, and upserts them
into Supabase `predictions`. The app reads them for the win-probability bar and a
real Super Predictor leaderboard.

This is a STUB: the fit/predict flow and the Supabase upsert shape are real; wire
the data source (penaltyblog scrapers or your own results table) and credentials.

Run nightly (cron / Vercel cron calling a thin endpoint / GitHub Action):
    pip install penaltyblog supabase
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python worker/predict.py
"""
import os

# import penaltyblog as pb
# from supabase import create_client


def fit_model(results_df):
    """Fit Dixon-Coles on a dataframe of past results (team_home, team_away,
    goals_home, goals_away, date). Returns a fitted model."""
    # clf = pb.models.DixonColesGoalModel(
    #     results_df["goals_home"], results_df["goals_away"],
    #     results_df["team_home"], results_df["team_away"],
    # )
    # clf.fit()
    # return clf
    raise NotImplementedError("wire penaltyblog + a results source")


def predict(clf, home, away):
    """Return (prob_home, prob_draw, prob_away) normalised to 1."""
    # probs = clf.predict(home, away)          # penaltyblog FootballProbabilityGrid
    # return probs.home_win, probs.draw, probs.away_win
    raise NotImplementedError


def upsert_predictions(rows):
    """rows: [{match_id, prob_a, prob_draw, prob_b, model}]"""
    # sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    # sb.table("predictions").upsert(rows).execute()
    print(f"would upsert {len(rows)} predictions")


def main():
    # results = load_recent_results()          # penaltyblog: FBref / Understat / Club Elo
    # clf = fit_model(results)
    # fixtures = load_upcoming_fixtures()      # from Supabase `matches` where status='pre'
    # rows = []
    # for f in fixtures:
    #     pa, pd, pb_ = predict(clf, f["team_a"], f["team_b"])
    #     rows.append({"match_id": f["id"], "prob_a": pa, "prob_draw": pd,
    #                  "prob_b": pb_, "model": "dixon-coles"})
    # upsert_predictions(rows)
    print("RALLY prediction worker (stub). See docs/HANDOFF-backend.md §2.5.")


if __name__ == "__main__":
    main()
