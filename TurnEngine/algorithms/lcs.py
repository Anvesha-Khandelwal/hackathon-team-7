"""
algorithms/lcs.py
-----------------
Longest Common Subsequence (LCS) between two board state strings.

LCS is a classic DAA dynamic-programming problem.
We use it to measure how *similar* two board states are:

    Similarity (%) = (LCS length / max(len(s1), len(s2))) × 100
"""


def lcs_length(s1: str, s2: str) -> int:
    """
    Return the length of the Longest Common Subsequence of s1 and s2.

    Time  complexity : O(m × n)
    Space complexity : O(m × n)  — full DP table kept for clarity
    """
    m, n = len(s1), len(s2)

    # dp[i][j] = LCS length of s1[:i] and s2[:j]
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    return dp[m][n]


def similarity_percentage(s1: str, s2: str) -> float:
    """
    Return a 0–100 similarity score between two board-state strings.

    Formula: (LCS_length / max_length) × 100
    Returns 100.0 when both strings are identical, 0.0 when they share nothing.
    """
    if not s1 and not s2:
        return 100.0
    max_len = max(len(s1), len(s2))
    if max_len == 0:
        return 100.0
    lcs_len = lcs_length(s1, s2)
    return round((lcs_len / max_len) * 100, 2)


# ── quick self-test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    a = "XO.X..O.."   # board state 1
    b = "XO.X..OX."   # board state 2  (one extra X placed)

    print(f"State A : {a}")
    print(f"State B : {b}")
    print(f"LCS len : {lcs_length(a, b)}")
    print(f"Similarity: {similarity_percentage(a, b)}%")