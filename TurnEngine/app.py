"""
app.py
------
Flask backend for TurnEngine.

Endpoints
---------
GET  /login             → serve login page
POST /login             → validate player names, store in session
POST /logout            → clear session
GET  /                  → serve the game (protected, redirects to /login)
POST /move              → make a move  { row, col }
POST /reset             → reset the board
GET  /state             → get current board state
GET  /analysis          → run LCS + edit-distance analysis on history
GET  /history           → return full state history
GET  /race_condition    → run race condition (unsafe) demo
GET  /semaphore_safe    → run semaphore-protected (safe) demo
POST /semaphore_demo    → run full demo (race + safe combined)
GET  /strategy_compare  → compare Player 1 vs Player 2 move strategies
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from flask import (
    Flask, jsonify, request, render_template,
    redirect, url_for, session
)
from game.board import Board
from synchronization.semaphore_demo import (
    run_race_condition_demo,
    run_semaphore_demo,
    run_full_demo as run_demo,
)
from algorithms.lcs import lcs_length, lcs_similarity
from algorithms.edit_distance import edit_distance

app = Flask(__name__)
app.secret_key = "turnengine-secret-key-2024"

# One shared Board instance (single-game demo)
board = Board()


# ── Auth helpers ──────────────────────────────────────────────────────────────

def logged_in():
    return "player1" in session and "player2" in session


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route("/login", methods=["GET"])
def login_page():
    if logged_in():
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(force=True)
    p1 = (data.get("player1") or "").strip()
    p2 = (data.get("player2") or "").strip()

    if not p1 or not p2:
        return jsonify({"success": False, "message": "Both player names are required."}), 400
    if p1.lower() == p2.lower():
        return jsonify({"success": False, "message": "Players must have different names."}), 400
    if len(p1) > 20 or len(p2) > 20:
        return jsonify({"success": False, "message": "Names must be 20 characters or fewer."}), 400

    session["player1"] = p1
    session["player2"] = p2
    board.reset()
    return jsonify({"success": True, "redirect": url_for("index")})


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    board.reset()
    return jsonify({"success": True, "redirect": url_for("login_page")})


# ── Pages ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if not logged_in():
        return redirect(url_for("login_page"))
    return render_template(
        "index.html",
        player1=session["player1"],
        player2=session["player2"],
    )


# ── Game API ──────────────────────────────────────────────────────────────────

@app.route("/move", methods=["POST"])
def move():
    if not logged_in():
        return jsonify({"success": False, "message": "Not logged in."}), 401

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

    # Inject player names into response
    result["player1_name"] = session.get("player1", "Player 1")
    result["player2_name"] = session.get("player2", "Player 2")
    return jsonify(result)


@app.route("/reset", methods=["POST"])
def reset():
    board.reset()
    return jsonify({
        "success":    True,
        "message":    "Board reset.",
        "board":      board.to_display(),
        "state_str":  board.to_string(),
        "player1_name": session.get("player1", "Player 1"),
        "player2_name": session.get("player2", "Player 2"),
    })


@app.route("/state", methods=["GET"])
def state():
    return jsonify({
        "board":            board.to_display(),
        "state_str":        board.to_string(),
        "current_player":   board.current_player,
        "move_count":       board.move_count,
        "game_over":        board.game_over,
        "winner":           board.winner,
        "player1_name":     session.get("player1", "Player 1"),
        "player2_name":     session.get("player2", "Player 2"),
    })


@app.route("/analysis", methods=["GET"])
def analysis():
    result = board.get_full_analysis()
    return jsonify(result)


@app.route("/history", methods=["GET"])
def history():
    return jsonify({
        "history":     board.history,
        "total_moves": len(board.history) - 1,
    })


@app.route("/move_log", methods=["GET"])
def move_log():
    """Return full ordered move log with RC codes, states, analysis."""
    return jsonify({
        "move_log":    board.get_move_log(),
        "total_moves": board.move_count,
        "x_seq":       "".join(board.x_moves),
        "o_seq":       "".join(board.o_moves),
        "analysis":    board.get_full_analysis(),
    })


# ── Synchronization API ───────────────────────────────────────────────────────

@app.route("/race_condition", methods=["GET"])
def race_condition():
    """Run the unsafe race-condition demo (no semaphore)."""
    try:
        result = run_race_condition_demo()
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/semaphore_safe", methods=["GET"])
def semaphore_safe():
    """Run the safe semaphore-protected demo."""
    try:
        result = run_semaphore_demo()
        return jsonify(result)
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


@app.route("/semaphore_demo", methods=["POST"])
def semaphore_demo():
    """Full demo: race condition + semaphore combined."""
    try:
        log = run_demo()
        return jsonify({"success": True, "log": log})
    except Exception as exc:
        return jsonify({"success": False, "message": str(exc)}), 500


# ── Strategy Compare API ──────────────────────────────────────────────────────

@app.route("/strategy_compare", methods=["GET"])
def strategy_compare():
    """
    Build each player's move string from board history.
    Player X always moves first (odd indices in history = after X moves),
    Player O second (even indices = after O moves).
    Compare using Edit Distance + LCS Similarity.
    """
    history = board.history
    if len(history) < 3:
        return jsonify({
            "player_x_moves": "",
            "player_o_moves": "",
            "edit_distance":  None,
            "similarity":     None,
            "report":         "Not enough moves to compare strategies yet.",
        })

    # Encode each move as a 2-digit string "rc" (row+col)
    x_moves = []
    o_moves = []
    for i in range(1, len(history)):
        prev, curr = history[i - 1], history[i]
        for j in range(9):
            if prev[j] != curr[j]:
                player = "X" if i % 2 == 1 else "O"
                move_code = str(j // 3) + str(j % 3)
                if player == "X":
                    x_moves.append(move_code)
                else:
                    o_moves.append(move_code)
                break

    x_str = "".join(x_moves)
    o_str = "".join(o_moves)

    if not x_str or not o_str:
        return jsonify({
            "player_x_moves": x_str,
            "player_o_moves": o_str,
            "edit_distance":  None,
            "similarity":     None,
            "report":         "Waiting for both players to move.",
        })

    ed  = edit_distance(x_str, o_str)
    sim = lcs_similarity(x_str, o_str)

    if sim >= 80:
        report = "Very Similar strategies — possible mirroring or stalling!"
    elif sim >= 50:
        report = "Moderately similar strategies."
    else:
        report = "Distinct strategies — players are playing differently."

    return jsonify({
        "player_x_moves":  x_str,
        "player_o_moves":  o_str,
        "edit_distance":   ed,
        "similarity":      sim,
        "report":          report,
        "player1_name":    session.get("player1", "Player X"),
        "player2_name":    session.get("player2", "Player O"),
    })


# ── Run ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000)