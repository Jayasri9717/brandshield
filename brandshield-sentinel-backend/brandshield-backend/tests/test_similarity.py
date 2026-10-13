"""String similarity for brand-impersonation detection.

Public API
----------
levenshtein_distance(a, b)        -> int    number of single-character edits
levenshtein_similarity(a, b)      -> float  0.0-1.0 (1.0 = identical)
jaro_winkler_similarity(a, b)     -> float  0.0-1.0, extra weight on shared prefix
combined_similarity(a, b)         -> float  0.0-1.0, weighted blend of the two

No third-party dependencies.
"""

import unicodedata

# Weights for combined_similarity. They must sum to 1.0.
LEVENSHTEIN_WEIGHT = 0.4
JARO_WINKLER_WEIGHT = 0.6


def normalize(text: str) -> str:
    """Lowercase, strip whitespace and fold compatibility characters.

    NFKC folds things like full-width letters to plain ones. It does NOT
    turn Cyrillic 'a' into Latin 'a' - that is the homoglyph module's job,
    and it must stay visible as a difference here.
    """
    if text is None:
        return ""
    return unicodedata.normalize("NFKC", str(text)).strip().lower()


def levenshtein_distance(a: str, b: str) -> int:
    """Minimum number of insertions, deletions and substitutions to turn a into b."""
    a, b = normalize(a), normalize(b)
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):  # keep the inner row as short as possible
        a, b = b, a

    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            current.append(
                min(
                    previous[j] + 1,                 # deletion
                    current[j - 1] + 1,              # insertion
                    previous[j - 1] + (ca != cb),    # substitution
                )
            )
        previous = current
    return previous[-1]


def levenshtein_similarity(a: str, b: str) -> float:
    """Levenshtein distance scaled to 0.0-1.0 (1.0 = identical)."""
    a, b = normalize(a), normalize(b)
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0  # two empty strings are identical
    return 1.0 - levenshtein_distance(a, b) / longest


def _jaro(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0

    window = max(max(len(a), len(b)) // 2 - 1, 0)
    a_matched = [False] * len(a)
    b_matched = [False] * len(b)

    matches = 0
    for i, ca in enumerate(a):
        lo, hi = max(0, i - window), min(len(b), i + window + 1)
        for j in range(lo, hi):
            if not b_matched[j] and b[j] == ca:
                a_matched[i] = b_matched[j] = True
                matches += 1
                break
    if matches == 0:
        return 0.0

    transpositions, k = 0, 0
    for i in range(len(a)):
        if a_matched[i]:
            while not b_matched[k]:
                k += 1
            if a[i] != b[k]:
                transpositions += 1
            k += 1
    transpositions //= 2

    return (
        matches / len(a) + matches / len(b) + (matches - transpositions) / matches
    ) / 3.0


def jaro_winkler_similarity(a: str, b: str, prefix_scale: float = 0.1) -> float:
    """Jaro similarity boosted for a shared prefix (up to 4 characters)."""
    a, b = normalize(a), normalize(b)
    jaro = _jaro(a, b)
    prefix = 0
    for ca, cb in zip(a[:4], b[:4]):
        if ca != cb:
            break
        prefix += 1
    return min(1.0, jaro + prefix * prefix_scale * (1.0 - jaro))


def combined_similarity(a: str, b: str) -> float:
    """Weighted blend of Levenshtein and Jaro-Winkler similarity, 0.0-1.0.

    Jaro-Winkler gets more weight because impersonators usually keep the real
    brand as a prefix ("zomato" -> "zomato_support"), which it rewards.
    """
    score = (
        LEVENSHTEIN_WEIGHT * levenshtein_similarity(a, b)
        + JARO_WINKLER_WEIGHT * jaro_winkler_similarity(a, b)
    )
    return round(max(0.0, min(1.0, score)), 4)
