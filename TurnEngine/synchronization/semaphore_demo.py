"""
=======================================================================
  TurnEngine – OS Synchronization Module
  Person 3 Responsibility: Threading + Semaphores + Race-Condition Demo
=======================================================================

CONCEPTS DEMONSTRATED
─────────────────────
1. Shared Critical Section   → the game board is a shared resource
2. Race Condition (unsafe)   → two threads write concurrently → corruption
3. Mutual Exclusion (safe)   → semaphore serialises board access
4. Thread Lifecycle          → create → start → join for each player

HOW IT INTEGRATES WITH THE PROJECT
───────────────────────────────────
Flask (app.py) calls:
    run_race_condition_demo()   → returns JSON-serialisable dict
    run_semaphore_demo()        → returns JSON-serialisable dict
    run_full_demo()             → returns both results combined
"""

import threading
import time
import random
import copy
import json
from datetime import datetime


# ══════════════════════════════════════════════════════════════════════
#  SHARED BOARD CLASS  (simulates the board owned by game/board.py)
# ══════════════════════════════════════════════════════════════════════

class SharedBoard:
    """
    A 3×3 game board that acts as the CRITICAL SECTION.
    Both Player-1 and Player-2 threads compete to write here.
    """

    EMPTY = "."

    def __init__(self):
        self.grid = [[self.EMPTY] * 3 for _ in range(3)]
        self.move_count = 0
        self.corruption_detected = False
        self.event_log: list[str] = []          # human-readable log
        self._internal_lock = threading.Lock()  # only used for log writes

    # ── helpers ──────────────────────────────────────────────────────

    def reset(self):
        self.grid = [[self.EMPTY] * 3 for _ in range(3)]
        self.move_count = 0
        self.corruption_detected = False
        self.event_log = []

    def _log(self, msg: str):
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        entry = f"[{ts}] {msg}"
        with self._internal_lock:
            self.event_log.append(entry)

    def to_string(self) -> str:
        return " ".join(cell for row in self.grid for cell in row)

    def to_display(self) -> list[list[str]]:
        return copy.deepcopy(self.grid)

    # ── UNSAFE write (no semaphore) ───────────────────────────────────

    def unsafe_place(self, player: str, row: int, col: int, symbol: str) -> bool:
        """
        Simulates an unprotected write.
        The artificial sleep WIDENS the race window so corruption is
        reliably visible even in fast hardware.
        """
        self._log(f"⚠  {player} entering critical section UNSAFELY "
                  f"→ wants ({row},{col})='{symbol}'")

        # ── READ phase ──
        current = self.grid[row][col]
        time.sleep(random.uniform(0.05, 0.15))          # widen race window

        # ── WRITE phase ──
        if current != self.EMPTY:
            # Another thread already wrote here while we were "thinking"
            self.corruption_detected = True
            self._log(f"💥 CORRUPTION! {player} overwrote ({row},{col}) "
                      f"'{current}' → '{symbol}'")
            self.grid[row][col] = symbol                # overwrite anyway
            return False                                # signal corruption
        else:
            self.grid[row][col] = symbol
            self.move_count += 1
            self._log(f"✓  {player} wrote ({row},{col})='{symbol}' "
                      f"(move #{self.move_count})")
            return True

    # ── SAFE write (with semaphore) ───────────────────────────────────

    def safe_place(self, sem: threading.Semaphore,
                   player: str, row: int, col: int, symbol: str) -> bool:
        """
        Semaphore-protected write.
        Only ONE thread can be inside the critical section at a time.
        """
        self._log(f"🔒 {player} waiting to acquire semaphore …")
        sem.acquire()                                   # ── P(sem) ──
        try:
            self._log(f"🟢 {player} acquired semaphore → entering "
                      f"critical section safely")
            current = self.grid[row][col]
            time.sleep(random.uniform(0.05, 0.15))      # same delay as unsafe

            if current != self.EMPTY:
                # Cell occupied – skip (normal game logic)
                self._log(f"↩  {player} skipped ({row},{col}) – already "
                          f"occupied by '{current}'")
                return False
            else:
                self.grid[row][col] = symbol
                self.move_count += 1
                self._log(f"✅ {player} safely wrote ({row},{col})='{symbol}' "
                          f"(move #{self.move_count})")
                return True
        finally:
            sem.release()                               # ── V(sem) ──
            self._log(f"🔓 {player} released semaphore")


# ══════════════════════════════════════════════════════════════════════
#  PLAYER THREAD WORKERS
# ══════════════════════════════════════════════════════════════════════

def player_worker_unsafe(board: SharedBoard,
                         player_name: str,
                         symbol: str,
                         moves: list[tuple[int, int]],
                         results: dict):
    """Thread target for the UNSAFE (race-condition) demo."""
    player_results = []
    for row, col in moves:
        success = board.unsafe_place(player_name, row, col, symbol)
        player_results.append({
            "cell": f"({row},{col})",
            "symbol": symbol,
            "success": success,
            "board_snapshot": board.to_string()
        })
        time.sleep(random.uniform(0.01, 0.05))
    results[player_name] = player_results


def player_worker_safe(board: SharedBoard,
                       sem: threading.Semaphore,
                       player_name: str,
                       symbol: str,
                       moves: list[tuple[int, int]],
                       results: dict):
    """Thread target for the SAFE (semaphore-protected) demo."""
    player_results = []
    for row, col in moves:
        success = board.safe_place(sem, player_name, row, col, symbol)
        player_results.append({
            "cell": f"({row},{col})",
            "symbol": symbol,
            "success": success,
            "board_snapshot": board.to_string()
        })
        time.sleep(random.uniform(0.01, 0.05))
    results[player_name] = player_results


# ══════════════════════════════════════════════════════════════════════
#  PUBLIC API  – called by Flask app.py
# ══════════════════════════════════════════════════════════════════════

def run_race_condition_demo() -> dict:
    """
    Demonstrates a RACE CONDITION on the shared board.

    Two player threads write to OVERLAPPING cells concurrently
    with NO synchronisation. Board corruption is expected.

    Returns
    -------
    dict  JSON-serialisable result consumed by Flask /semaphore endpoint
    """
    board = SharedBoard()
    board._log("═══ RACE CONDITION DEMO (No Semaphore) ═══")
    board._log("Both players will write to the board simultaneously.")
    board._log("No mutual exclusion → expect corruption!")

    # Deliberately give both players the SAME cells to guarantee conflict
    shared_cells   = [(0, 0), (0, 1), (1, 1)]
    player1_moves  = shared_cells + [(2, 2)]
    player2_moves  = shared_cells + [(2, 0)]

    thread_results: dict = {}

    t1 = threading.Thread(
        target=player_worker_unsafe,
        args=(board, "Player-1", "X", player1_moves, thread_results),
        name="Thread-Player1"
    )
    t2 = threading.Thread(
        target=player_worker_unsafe,
        args=(board, "Player-2", "O", player2_moves, thread_results),
        name="Thread-Player2"
    )

    board._log(f"Spawning {t1.name} and {t2.name} simultaneously …")
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    board._log("Both threads finished.")
    board._log(f"Corruption detected: {board.corruption_detected}")
    board._log(f"Final board: {board.to_string()}")

    return {
        "demo_type": "RACE CONDITION (Unsafe – No Semaphore)",
        "corruption_detected": board.corruption_detected,
        "final_board": board.to_display(),
        "final_board_string": board.to_string(),
        "total_moves_recorded": board.move_count,
        "player_results": thread_results,
        "event_log": board.event_log,
        "verdict": (
            "⚠ Board state CORRUPTED – cells overwritten by concurrent threads!"
            if board.corruption_detected
            else "No corruption this run (race is non-deterministic; re-run to see it)."
        )
    }


def run_semaphore_demo() -> dict:
    """
    Demonstrates SAFE concurrent access using a binary semaphore.

    The semaphore (initialised to 1) acts as a mutex:
      • sem.acquire() → P-operation (decrement / lock)
      • sem.release() → V-operation (increment / unlock)

    Only ONE thread may be inside the critical section at any moment.

    Returns
    -------
    dict  JSON-serialisable result consumed by Flask /semaphore endpoint
    """
    board  = SharedBoard()
    sem    = threading.Semaphore(1)         # binary semaphore (mutex)

    board._log("═══ SEMAPHORE DEMO (Safe – Mutual Exclusion) ═══")
    board._log("Semaphore(1) created – acting as a binary mutex.")
    board._log("Only ONE player thread may modify the board at a time.")

    # Same overlapping moves as the unsafe demo for fair comparison
    shared_cells   = [(0, 0), (0, 1), (1, 1)]
    player1_moves  = shared_cells + [(2, 2)]
    player2_moves  = shared_cells + [(2, 0)]

    thread_results: dict = {}

    t1 = threading.Thread(
        target=player_worker_safe,
        args=(board, sem, "Player-1", "X", player1_moves, thread_results),
        name="Thread-Player1"
    )
    t2 = threading.Thread(
        target=player_worker_safe,
        args=(board, sem, "Player-2", "O", player2_moves, thread_results),
        name="Thread-Player2"
    )

    board._log(f"Spawning {t1.name} and {t2.name} simultaneously …")
    t1.start()
    t2.start()
    t1.join()
    t2.join()
    board._log("Both threads finished – no corruption possible.")
    board._log(f"Final board: {board.to_string()}")

    return {
        "demo_type": "SEMAPHORE PROTECTED (Safe – Mutual Exclusion)",
        "corruption_detected": board.corruption_detected,
        "final_board": board.to_display(),
        "final_board_string": board.to_string(),
        "total_moves_recorded": board.move_count,
        "player_results": thread_results,
        "event_log": board.event_log,
        "verdict": (
            "✅ Board state INTACT – semaphore enforced mutual exclusion correctly!"
            if not board.corruption_detected
            else "Unexpected corruption – check semaphore logic."
        )
    }


def run_full_demo() -> dict:
    """
    Runs BOTH demos back-to-back and returns a combined report.
    Called by Flask route  GET /semaphore_demo
    """
    print("\n" + "═" * 60)
    print("  TurnEngine – OS Synchronisation Demo")
    print("═" * 60)

    print("\n[1/2] Running Race Condition Demo …")
    unsafe_result = run_race_condition_demo()

    print("\n[2/2] Running Semaphore Demo …")
    safe_result   = run_semaphore_demo()

    combined = {
        "timestamp": datetime.now().isoformat(),
        "race_condition_demo": unsafe_result,
        "semaphore_demo": safe_result,
        "summary": {
            "unsafe_corrupted": unsafe_result["corruption_detected"],
            "safe_corrupted":   safe_result["corruption_detected"],
            "conclusion": (
                "Semaphore successfully prevented race condition. "
                "Mutual exclusion guaranteed via P/V operations on Semaphore(1)."
            )
        }
    }

    _pretty_print_summary(unsafe_result, safe_result)
    return combined


# ══════════════════════════════════════════════════════════════════════
#  CONSOLE PRETTY-PRINT  (useful when running directly / debugging)
# ══════════════════════════════════════════════════════════════════════

def _pretty_print_summary(unsafe: dict, safe: dict):
    divider = "─" * 60

    print(f"\n{divider}")
    print("  RACE CONDITION DEMO RESULTS")
    print(divider)
    print(f"  Corruption Detected : {unsafe['corruption_detected']}")
    print(f"  Final Board String  : {unsafe['final_board_string']}")
    print(f"  Verdict             : {unsafe['verdict']}")
    print(f"\n  Event Log ({len(unsafe['event_log'])} entries):")
    for entry in unsafe["event_log"]:
        print(f"    {entry}")

    print(f"\n{divider}")
    print("  SEMAPHORE DEMO RESULTS")
    print(divider)
    print(f"  Corruption Detected : {safe['corruption_detected']}")
    print(f"  Final Board String  : {safe['final_board_string']}")
    print(f"  Verdict             : {safe['verdict']}")
    print(f"\n  Event Log ({len(safe['event_log'])} entries):")
    for entry in safe["event_log"]:
        print(f"    {entry}")

    print(f"\n{'═' * 60}")
    print("  CONCLUSION")
    print(f"{'═' * 60}")
    print("  Without semaphore  → race condition → board corrupted")
    print("  With    semaphore  → mutual exclusion → board safe")
    print(f"{'═' * 60}\n")


# ══════════════════════════════════════════════════════════════════════
#  STANDALONE ENTRY-POINT  (python semaphore_demo.py)
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    result = run_full_demo()
    # Optionally dump JSON for piping into other tools
    # print(json.dumps(result, indent=2))