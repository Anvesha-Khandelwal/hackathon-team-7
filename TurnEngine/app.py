"""
app.py
------
Flask backend for TurnEngine.

Endpoints
---------
GET  /              → serve the frontend
POST /move          → make a move  { row, col }
POST /reset         → reset the board
GET  /state         → get current board state
GET  /analysis      → run LCS + edit-distance analysis on history
GET  /history       → return full state history
POST /semaphore_demo → trigger semaphore demo (from Person 3's module)
"""

import sys
import os

# Make sure sub-packages are importable when running from project root
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, jsonify, request, render_template
from game.board import Board
from synchronization.semaphore_demo import run_demo

app = Flask(__name__)

# One shared Board instance (single-game demo)
board = Board()


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Game API ──────────────────────────────────────────────────────────────────

@app.route("/move", methods=["POST"])
def move():
    """
    Expects JSON body: { "row": 0-2, "col": 0-2 }
    Returns full result dict from Board.make_move().
    """
    data = request.get_json(force=True)
    row  = data.get("row")
    col  = data.get("col")

    if row is None or col is None:
        return jsonify({"success": False, "message": "row and col are required."}), 400

    try:
        row, col = int(row), int(col)
    except (TypeError, ValueError):
        return jsonify({"success": False, "message": "row and col must be integers."}), 400

    result = board.make_move(row, col)
    return jsonify(result)


@app.route("/reset", methods=["POST"])
def reset():
    """Reset the board to a fresh game."""
    board.reset()
    return jsonify({
        "success": True,
        "message": "Board reset.",
        "board":   board.to_display(),
        "state_str": board.to_string(),
    })


@app.route("/state", methods=["GET"])
def state():
    """Return current board state without making a move."""
    return jsonify({
        "board":          board.to_display(),
        "state_str":      board.to_string(),
        "current_player": board.current_player,
        "move_count":     board.move_count,
        "game_over":      board.game_over,
        "winner":         board.winner,
    })


@app.route("/analysis", methods=["GET"])
def analysis():
    """
    Run LCS + Edit Distance analysis on the current state vs full history.
    Returns:
        lcs_length, similarity (%), edit_distance,
        repeat_count, potential_draw, details[]
    """
    result = board.get_full_analysis()
    return jsonify(result)


@app.route("/history", methods=["GET"])
def history():
    """Return the full list of board-state strings recorded so far."""
    return jsonify({
        "history":     board.history,
        "total_moves": len(board.history) - 1,   # first entry is initial state
    })


# ── Synchronization API ───────────────────────────────────────────────────────

@app.route("/semaphore_demo", methods=["POST"])
def semaphore_demo():
    """
    Trigger the OS semaphore demo (Person 3's module).
    Returns a JSON log of the race-condition and safe-sync outputs.
    """
    try:
        log = run_demo()
        return jsonify({"success": True, "log": log})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)