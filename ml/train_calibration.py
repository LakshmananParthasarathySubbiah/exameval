"""
Confidence-calibration model — scikit-learn version (ML2).

Trains a logistic-regression model that predicts whether a human will OVERRIDE
the AI's score, so the review queue can be ranked riskiest-first. This is the
"production" counterpart to backend/src/ml/calibration.js (pure-JS trainer used
for the live review-ranking and unit tests).

Usage:
    pip install -r ml/requirements.txt
    # Export training data from the DB to CSV with columns:
    #   mean_confidence,min_confidence,answer_len_norm,ocr_used,injection_flagged,overridden
    python ml/train_calibration.py --data data/calibration.csv --out ml/calibration_model.joblib
"""
import argparse

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.model_selection import train_test_split

FEATURES = [
    "mean_confidence",
    "min_confidence",
    "answer_len_norm",
    "ocr_used",
    "injection_flagged",
]
TARGET = "overridden"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="CSV with FEATURES + TARGET columns")
    ap.add_argument("--out", default="ml/calibration_model.joblib")
    args = ap.parse_args()

    df = pd.read_csv(args.data)
    X = df[FEATURES].to_numpy(dtype=float)
    y = df[TARGET].to_numpy(dtype=int)

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
    )

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_tr, y_tr)

    proba = clf.predict_proba(X_te)[:, 1]
    auc = roc_auc_score(y_te, proba) if len(np.unique(y_te)) > 1 else float("nan")
    print(f"ROC-AUC: {auc:.3f}")
    print(classification_report(y_te, clf.predict(X_te)))
    print("Coefficients:", dict(zip(FEATURES, clf.coef_[0].round(3))))

    joblib.dump({"model": clf, "features": FEATURES}, args.out)
    print(f"Saved model → {args.out}")


if __name__ == "__main__":
    main()
