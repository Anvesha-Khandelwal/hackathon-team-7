"""
algorithms/edit_distance.py
---------------------------
Edit Distance (Levenshtein Distance) between two board state strings.

Edit distance counts the minimum number of single-character edits
(insertions, deletions, substitutions) needed to turn s1 into s2.

A small edit distance → states are very close → possible stalling.
"""


def edit_distance(s1: str, s2: str) -> int:
    """
    Return the Levenshtein (edit) distance between s1 and s2.

    Time  complexity : O(m × n)
    Space complexity : O(m × n)
    """
    m, n = len(s1), len(s2)

    # dp[i][j] = edit distance between s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    # Base cases: transforming to/from empty string
    for i in range(m + 1):
        dp[i][0] = i          # delete all chars of s1
    for j in range(n + 1):
        dp[0][j] = j          # insert all chars of s2

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]          # no edit needed
            else:
                dp[i][j] = 1 + min(
                    dp[i - 1][j],       # deletion
                    dp[i][j - 1],       # insertion
                    dp[i - 1][j - 1],   # substitution
                )

    return dp[m][n]


def normalized_distance(s1: str, s2: str) -> float:
    """
    Return edit distance normalized to [0, 1].
    0.0 = identical, 1.0 = completely different.
    """
    if not s1 and not s2:
        return 0.0
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 0.0
    return round(edit_distance(s1, s2) / max_len, 4)


# ── quick self-test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    a = "XO.X..O.."
    b = "XO.X..OX."

    print(f"State A       : {a}")
    print(f"State B       : {b}")
    print(f"Edit distance : {edit_distance(a, b)}")
    print(f"Normalized    : {normalized_distance(a, b)}")