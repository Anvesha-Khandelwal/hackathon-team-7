from typing import Optional
"""
game/board.py
-------------
Core board logic for a 3×3 Tic-Tac-Toe board.

Responsibilities
----------------
1. Create / reset the board
2. Validate and place moves
3. Save every state to history
4. Convert board to a compact string for algorithm comparison
5. Check win / draw conditions
6. Detect repeated-state / stalling situations using LCS & Edit Distance
"""

from algorithms.lcs import lcs_length, lcs_similarity
from algorithms.edit_distance import edit_distance

# ── Constants ────────────────────────────────────────────────────────────────
EMPTY   = "."
PLAYER1 = "X"
PLAYER2 = "O"

SIMILARITY_THRESHOLD = 80.0   # % — states above this are "too similar"
REPEAT_LIMIT         = 3      # same state appearing this many times → draw


class Board:
    """Manages board state, history, and draw detection for a 3×3 game."""

    def __init__(self):
        self.reset()

    # ── Setup ────────────────────────────────────────────────────────────────

    def reset(self):
        """Reset board to empty state and clear all history."""
        self.grid: list[list[str]] = [
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
        ]
        self.history: list[str] = []          # list of board-state strings
        self.current_player: str = PLAYER1
        self.move_count: int = 0
        self.game_over: bool = False
        self.winner: str | None = None
        # Save initial state
        self.history.append(self.to_string())

    # ── Conversion ───────────────────────────────────────────────────────────

    def to_string(self) -> str:
        """Flatten the 3×3 grid into a 9-character string (row-major)."""
        return "".join(cell for row in self.grid for cell in row)

    def to_display(self) -> list[list[str]]:
        """Return a copy of the grid (safe for JSON serialisation)."""
        return [row[:] for row in self.grid]

    # ── Move Handling ─────────────────────────────────────────────────────────

    def make_move(self, row: int, col: int) -> dict:
        """
        Attempt to place the current player's mark at (row, col).

        Returns a result dict with:
            success   : bool
            message   : str
            board     : list[list[str]]
            state_str : str
            winner    : str | None
            draw      : bool
            analysis  : dict  (LCS / edit-distance info)
        """
        # ── Validate ─────────────────────────────────────────────────────────
        if self.game_over:
            return self._result(False, "Game is already over.")

        if not (0 <= row <= 2 and 0 <= col <= 2):
            return self._result(False, "Invalid cell coordinates.")

        if self.grid[row][col] != EMPTY:
            return self._result(False, "Cell is already occupied.")

        # ── Place mark ───────────────────────────────────────────────────────
        self.grid[row][col] = self.current_player
        self.move_count += 1
        new_state = self.to_string()
        self.history.append(new_state)

        # ── Check win / draw ─────────────────────────────────────────────────
        if self._check_winner(self.current_player):
            self.game_over = True
            self.winner = self.current_player
            return self._result(
                True,
                f"Player {self.current_player} wins!",
                winner=self.current_player,
            )

        if self.move_count == 9:
            self.game_over = True
            return self._result(True, "Board full — it's a draw!", draw=True)

        # ── Analyse state similarity ──────────────────────────────────────────
        analysis = self._analyse_states(new_state)

        # ── Switch player ────────────────────────────────────────────────────
        self.current_player = PLAYER2 if self.current_player == PLAYER1 else PLAYER1

        potential_draw = analysis["potential_draw"]
        msg = "Potential stalling/draw detected!" if potential_draw else \
              f"Move accepted. Player {self.current_player}'s turn."

        return self._result(True, msg, draw=potential_draw, analysis=analysis)

    # ── Analysis ─────────────────────────────────────────────────────────────

    def _analyse_states(self, current_state: str) -> dict:
        """
        Compare current state against history using LCS and Edit Distance.

        Returns a summary dict used by the Flask API.
        """
        if len(self.history) < 2:
            return {
                "lcs_length": 0,
                "similarity": 0.0,
                "edit_distance": 0,
                "repeat_count": 1,
                "potential_draw": False,
                "details": [],
            }

        similarities = []
        edit_distances = []

        # Compare against every previous state (excluding the current one
        # which is already at the end of history)
        previous_states = self.history[:-1]

        for prev in previous_states:
            sim   = lcs_similarity(current_state, prev)
            edist = edit_distance(current_state, prev)
            similarities.append(sim)
            edit_distances.append(edist)

        max_similarity  = max(similarities)
        min_edit_dist   = min(edit_distances)
        repeat_count    = self.history.count(current_state)

        # Build per-state detail list (for frontend display)
        details = [
            {
                "state":         prev,
                "similarity":    sim,
                "edit_distance": edist,
            }
            for prev, sim, edist in zip(previous_states, similarities, edit_distances)
        ]

        threefold     = repeat_count >= REPEAT_LIMIT
        potential_draw = (
            max_similarity >= SIMILARITY_THRESHOLD or threefold
        )

        return {
            "lcs_length":    lcs_length(current_state, previous_states[-1]),
            "similarity":    max_similarity,
            "edit_distance": min_edit_dist,
            "repeat_count":  repeat_count,
            "threefold":     threefold,
            "potential_draw": potential_draw,
            "threshold":     SIMILARITY_THRESHOLD,
            "details":       details,
        }

    def get_full_analysis(self) -> dict:
        """
        Run analysis on the current (latest) state against all history.
        Called by the /analysis Flask endpoint.
        """
        if not self.history:
            return {}
        current = self.history[-1]
        return self._analyse_states(current)

    # ── Win Detection ─────────────────────────────────────────────────────────

    def _check_winner(self, player: str) -> bool:
        g = self.grid
        # Rows and columns
        for i in range(3):
            if all(g[i][j] == player for j in range(3)):
                return True
            if all(g[j][i] == player for j in range(3)):
                return True
        # Diagonals
        if all(g[i][i]     == player for i in range(3)): return True
        if all(g[i][2 - i] == player for i in range(3)): return True
        return False

    # ── Helper ───────────────────────────────────────────────────────────────

    def _result(
        self,
        success: bool,
        message: str,
        winner: Optional[str] = None,
        draw:   bool       = False,
        analysis: dict     = None,
    ) -> dict:
        return {
            "success":        success,
            "message":        message,
            "board":          self.to_display(),
            "state_str":      self.to_string(),
            "current_player": self.current_player,
            "move_count":     self.move_count,
            "winner":         winner,
            "draw":           draw,
            "game_over":      self.game_over,
            "analysis":       analysis or {},
        }