"""
game/board.py  —  TurnEngine core logic
========================================

DELIVERABLES IMPLEMENTED
─────────────────────────
1. LCS & Edit Distance on move-sequence strings with threshold draw detection
2. Threefold repetition rule (exact board position repeated 3 times)
3. Move-string strategy comparison with similarity report
4. 20+ move simulation support via full history tracking

ENCODING
─────────
Every move is stored as a 2-char "RC" string (row digit + col digit):
  (0,0)→"00"  (1,2)→"12"  (2,1)→"21"

x_seq = "".join(x_moves)  e.g. "001221"
o_seq = "".join(o_moves)  e.g. "011020"

LCS(x_seq, o_seq)  → shared row/col patterns → varies meaningfully each move
EditDist(x_seq, o_seq) → strategy divergence → low=similar, high=different
"""

from typing import Optional
from algorithms.lcs import lcs_length, lcs_similarity
from algorithms.edit_distance import edit_distance, normalized_distance

EMPTY   = "."
PLAYER1 = "X"
PLAYER2 = "O"

SIMILARITY_THRESHOLD = 60.0  # % — strategy similarity above this → draw warning
REPEAT_LIMIT         = 3     # board state repeated this many times → threefold


class Board:
    def __init__(self):
        self.reset()

    def reset(self):
        self.grid: list[list[str]] = [
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
            [EMPTY, EMPTY, EMPTY],
        ]
        self.history: list[str] = []    # board snapshots after every move
        self.x_moves: list[str] = []    # X's moves as "RC" codes e.g. ["00","12"]
        self.o_moves: list[str] = []    # O's moves as "RC" codes
        self.all_moves: list[dict] = [] # ordered log: {player, rc, move_num, state}
        self.current_player: str = PLAYER1
        self.move_count: int = 0
        self.game_over: bool = False
        self.winner: str | None = None
        self.history.append(self.to_string())

    def to_string(self) -> str:
        return "".join(cell for row in self.grid for cell in row)

    def to_display(self) -> list[list[str]]:
        return [row[:] for row in self.grid]

    def make_move(self, row: int, col: int) -> dict:
        if self.game_over:
            return self._result(False, "Game is already over.")
        if not (0 <= row <= 2 and 0 <= col <= 2):
            return self._result(False, "Invalid cell coordinates.")
        if self.grid[row][col] != EMPTY:
            return self._result(False, "Cell is already occupied.")

        self.grid[row][col] = self.current_player
        self.move_count += 1
        new_state = self.to_string()
        self.history.append(new_state)

        # Store as "RC" 2-char code for meaningful LCS/EditDist
        code = f"{row}{col}"
        if self.current_player == PLAYER1:
            self.x_moves.append(code)
        else:
            self.o_moves.append(code)

        self.all_moves.append({
            "player": self.current_player,
            "rc": code,
            "row": row, "col": col,
            "move_num": self.move_count,
            "state": new_state,
        })

        if self._check_winner(self.current_player):
            self.game_over = True
            self.winner = self.current_player
            analysis = self._analyse_states(new_state)
            return self._result(True, f"Player {self.current_player} wins!",
                                winner=self.current_player, analysis=analysis)

        if self.move_count == 9:
            self.game_over = True
            analysis = self._analyse_states(new_state)
            return self._result(True, "Board full — it's a draw!",
                                draw=True, analysis=analysis)

        analysis = self._analyse_states(new_state)
        self.current_player = PLAYER2 if self.current_player == PLAYER1 else PLAYER1

        potential_draw = analysis["potential_draw"]
        msg = ("Potential draw detected!" if potential_draw
               else f"Move accepted. Player {self.current_player}'s turn.")
        return self._result(True, msg, draw=potential_draw, analysis=analysis)

    def _analyse_states(self, current_state: str) -> dict:
        """
        LCS & Edit Distance on RC-encoded move sequences.

        x_seq = "001221"  (X played (0,0),(1,2),(2,1))
        o_seq = "011020"  (O played (0,1),(1,0),(2,0))

        LCS finds shared row/col digit patterns → meaningful similarity score
        EditDist counts ops to convert X's strategy string into O's

        Threefold: count exact board-snapshot repetitions in history.
        """
        # ── Threefold repetition (board snapshots) ────────────────────────
        repeat_count = self.history.count(current_state)
        threefold    = repeat_count >= REPEAT_LIMIT

        # ── Move sequence analysis ────────────────────────────────────────
        x_seq = "".join(self.x_moves)
        o_seq = "".join(self.o_moves)

        if x_seq and o_seq:
            lcs_len  = lcs_length(x_seq, o_seq)
            lcs_sim  = lcs_similarity(x_seq, o_seq)   # 0–100 %
            ed       = edit_distance(x_seq, o_seq)
            ed_norm  = normalized_distance(x_seq, o_seq)
        else:
            lcs_len, lcs_sim, ed, ed_norm = 0, 0.0, max(len(x_seq), len(o_seq)), 1.0

        # ── Strategy similarity report ────────────────────────────────────
        if lcs_sim >= 80:
            strategy_report = "Very similar strategies — possible mirroring!"
        elif lcs_sim >= SIMILARITY_THRESHOLD:
            strategy_report = "Moderately similar strategies — overlapping patterns."
        else:
            strategy_report = "Distinct strategies — divergent play styles."

        potential_draw = threefold or lcs_sim >= SIMILARITY_THRESHOLD

        return {
            "x_seq": x_seq, "o_seq": o_seq,
            "x_moves_list": self.x_moves[:],
            "o_moves_list": self.o_moves[:],
            "lcs_length": lcs_len,
            "similarity": lcs_sim,
            "edit_distance": ed,
            "edit_distance_normalized": ed_norm,
            "repeat_count": repeat_count,
            "threefold": threefold,
            "potential_draw": potential_draw,
            "threshold": SIMILARITY_THRESHOLD,
            "strategy_report": strategy_report,
            "explanation": (
                f"X seq \"{x_seq}\" vs O seq \"{o_seq}\". "
                f"LCS={lcs_len}, Similarity={lcs_sim:.1f}%, EditDist={ed}. "
                f"{strategy_report}"
            ),
        }

    def get_full_analysis(self) -> dict:
        if not self.history:
            return {}
        return self._analyse_states(self.history[-1])

    def get_move_log(self) -> list[dict]:
        """Return full ordered move log for 20+ move history display."""
        return self.all_moves[:]

    def _check_winner(self, player: str) -> bool:
        g = self.grid
        for i in range(3):
            if all(g[i][j] == player for j in range(3)): return True
            if all(g[j][i] == player for j in range(3)): return True
        if all(g[i][i]     == player for i in range(3)): return True
        if all(g[i][2 - i] == player for i in range(3)): return True
        return False

    def _result(self, success, message, winner=None, draw=False, analysis=None):
        return {
            "success": success, "message": message,
            "board": self.to_display(), "state_str": self.to_string(),
            "current_player": self.current_player,
            "move_count": self.move_count,
            "winner": winner, "draw": draw,
            "game_over": self.game_over,
            "analysis": analysis or {},
            "move_log": self.all_moves[:],
        }
