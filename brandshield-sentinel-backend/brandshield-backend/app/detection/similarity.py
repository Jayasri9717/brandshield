"""Small, dependency-free string similarity functions for lookalike checks."""

import unicodedata


def normalize(text: str | None) -> str:
    """Normalize compatible Unicode forms and whitespace without transliteration."""
    if text is None:
        return ""
    return unicodedata.normalize("NFKC", str(text)).strip().casefold()


def levenshtein_distance(a: str, b: str) -> int:
    """Return the minimum number of single-character edits between two strings."""
    a, b = normalize(a), normalize(b)
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a

    previous = list(range(len(b) + 1))
    for row, char_a in enumerate(a, start=1):
        current = [row]
        for column, char_b in enumerate(b, start=1):
            current.append(
                min(
                    previous[column] + 1,
                    current[column - 1] + 1,
                    previous[column - 1] + (char_a != char_b),
                )
            )
        previous = current
    return previous[-1]


def levenshtein_similarity(a: str, b: str) -> float:
    """Scale edit distance to 0–1, where 1 means identical."""
    a, b = normalize(a), normalize(b)
    longest = max(len(a), len(b))
    if longest == 0:
        return 1.0
    return 1.0 - levenshtein_distance(a, b) / longest


def _jaro_similarity(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0

    window = max(max(len(a), len(b)) // 2 - 1, 0)
    a_matched = [False] * len(a)
    b_matched = [False] * len(b)
    matches = 0

    for index, char_a in enumerate(a):
        start = max(0, index - window)
        end = min(len(b), index + window + 1)
        for other_index in range(start, end):
            if not b_matched[other_index] and b[other_index] == char_a:
                a_matched[index] = b_matched[other_index] = True
                matches += 1
                break

    if matches == 0:
        return 0.0
    transpositions = 0
    next_b_index = 0
    for index, matched in enumerate(a_matched):
        if not matched:
            continue
        while not b_matched[next_b_index]:
            next_b_index += 1
        if a[index] != b[next_b_index]:
            transpositions += 1
        next_b_index += 1

    return (
        matches / len(a)
        + matches / len(b)
        + (matches - transpositions / 2) / matches
    ) / 3


def jaro_winkler_similarity(a: str, b: str, prefix_scale: float = 0.1) -> float:
    """Jaro–Winkler similarity, with a small boost for a shared prefix."""
    a, b = normalize(a), normalize(b)
    jaro = _jaro_similarity(a, b)
    prefix_length = 0
    for char_a, char_b in zip(a[:4], b[:4]):
        if char_a != char_b:
            break
        prefix_length += 1
    return min(1.0, jaro + prefix_length * prefix_scale * (1.0 - jaro))


def combined_similarity(a: str | None, b: str | None) -> float:
    """Blend edit similarity (40%) and prefix-aware Jaro–Winkler (60%)."""
    if a is None or b is None:
        return 0.0
    score = 0.4 * levenshtein_similarity(a, b) + 0.6 * jaro_winkler_similarity(a, b)
    return round(max(0.0, min(1.0, score)), 4)
