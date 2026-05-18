"""
algorithms/lcs.py
─────────────────
Longest Common Subsequence — Dynamic Programming implementation.
Used to measure similarity between two board-state strings.
"""


def lcs_length(s1: str, s2: str) -> int:
    """
    Returns the length of the Longest Common Subsequence of s1 and s2.
    Time: O(m*n)  |  Space: O(m*n)
    """
    m, n = len(s1), len(s2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    return dp[m][n]


def lcs_similarity(s1: str, s2: str) -> float:
    """Returns similarity as a percentage (0–100)."""
    if not s1 and not s2:
        return 100.0
    max_len = max(len(s1), len(s2))
    return round((lcs_length(s1, s2) / max_len) * 100, 2)