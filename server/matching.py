from rapidfuzz import fuzz
import re

def extract_numbers(texts):
    nums = []
    for t in texts:
        for m in re.finditer(r"\d+(?:\.\d+)?", t):
            nums.append(m.group())
    return nums

def fuzzy_numeric_match(candidates, table_rows, tol=0.2):
    """Return best match for numeric candidates from PDF in the template rows.
    tol is absolute difference allowed when comparing numeric values.
    """
    def to_float(x):
        try:
            return float(x)
        except Exception:
            return None

    best = None
    best_score = -1

    cand_floats = [to_float(c) for c in candidates]

    for row in table_rows:
        # Gather numbers in row
        row_nums = [to_float(n) for n in extract_numbers([row])]
        # Any close match?
        score = 0
        for cf in cand_floats:
            if cf is None: continue
            for rn in row_nums:
                if rn is None: continue
                if abs(cf - rn) <= tol:
                    score = max(score, 100)
        # textual fuzz as fallback
        if score == 0:
            for c in candidates:
                score = max(score, fuzz.partial_ratio(c, row))
        if score > best_score:
            best_score = score
            best = row
    return best, best_score