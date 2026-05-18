# TurnEngine — Competitive Game Validator

A Tic-Tac-Toe based competitive game validator that demonstrates core Computer Science concepts including Dynamic Programming algorithms, Operating System synchronization, and real-time game state analysis.

---

## Features

### DAA Tab — Algorithm Analysis
- **LCS (Longest Common Subsequence)** — compares player move sequences to measure strategy similarity
- **Edit Distance (Levenshtein)** — measures how different two players' strategies are
- **RC Encoding** — every move is encoded as a 2-character row-column string (e.g. `(0,1) → "01"`) enabling string algorithm analysis
- **Threshold-based Draw Detection** — flags a draw warning when board state similarity exceeds a set threshold
- **Real-time Analytics** — LCS and Edit Distance recomputed and logged after every move

### OS Concepts Tab — Synchronization Demo
- **Race Condition Demonstration** — shows two threads corrupting the shared board without synchronization
- **Semaphore Fix** — binary semaphore with animated `wait()` / `signal()` operations
- **S Counter Animation** — semaphore value animates `1→0→1→0→1` live
- **Step-by-step Event Log** — timestamped, color-coded log of every thread operation
- **Before/After Comparison** — side-by-side code showing the race condition and the fix

### Analytics Tab — Move History
- Full move log: move number, player, cell (R,C), board state, LCS, edit distance, repeat count, event flags
- **Strategy Similarity Report** — Compare button generates a color-coded verdict (e.g. "Distinct strategies (33%) — LCS=2, ED=4. Divergent play styles.")
- **Threefold Repetition Detection** — board snapshots tracked in a repeat map; three purple indicators light up one by one; `♻ Threefold Repetition` alert fires at count 3

### Simulation
- **Simulate 20+ Moves** button runs 3 games back-to-back (27+ total moves)
  - Game 1: Full 9-move draw with LCS/ED analysis
  - Game 2: 3-move opening repeated 3× to trigger threefold repetition (15 moves)
  - Game 3: Strategy similarity detection (9 moves)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask |
| Frontend | HTML, CSS, JavaScript |
| Server | Gunicorn (production) |
| Algorithms | LCS, Edit Distance (Dynamic Programming) |
| Synchronization | Semaphore (OS Concepts) |
| Deployment | Render |

---

## Project Structure

```
hackathon-team-7/
├── TurnEngine/
│   ├── app.py                  # Flask application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── algorithms/             # LCS, Edit Distance implementations
│   ├── game/
│   │   └── board.py            # Board state, move tracking, draw detection
│   ├── synchronization/        # Semaphore demo logic
│   ├── static/                 # CSS, JS assets
│   └── templates/
│       ├── index.html          # Main game interface
│       └── login.html          # Match registration page
├── render.yaml                 # Render deployment config
├── requirements.txt            # Root-level dependencies
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.10+
- pip

### Run Locally

```bash
# Clone the repository
git clone https://github.com/Anvesha-Khandelwal/hackathon-team-7.git
cd hackathon-team-7/TurnEngine

# Install dependencies
pip install -r requirements.txt

# Start the development server
python app.py
```

Visit `http://127.0.0.1:5000` in your browser.

---

## Deployment

The app is deployed on **Render** from the `chahat` branch.

`render.yaml` config:
```yaml
services:
  - type: web
    name: turnengine
    runtime: python
    rootDir: TurnEngine
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
```

---

## Algorithm Details

### LCS — Longest Common Subsequence
Compares two players' move strings to find the longest common subsequence of moves.

```
Player X moves: (0,0)→(0,1)→(0,2)  →  "000102"
Player O moves: (1,0)→(2,0)         →  "1020"
LCS = 3,  Similarity = 3/6 = 50%
```

Time complexity: `O(m × n)` where m and n are the lengths of the two move strings.

### Edit Distance — Levenshtein Distance
Measures the minimum number of insert, delete, or substitute operations to convert one move string into another.

```
EditDistance("000102", "1020") = 4
```

Time complexity: `O(m × n)`

### Threefold Repetition
After every move, the board is serialized to a string and stored in a repeat map. When the same board state appears 3 times, a draw is declared.

```python
repeatMap["XO_X_OX__"] = 3  # → Threefold Repetition triggered ♻
```

### Semaphore (Binary)
```
S = 1  (board is free)
Thread 1: wait(S)  → S = 0  (Thread 1 enters critical section)
Thread 2: wait(S)  → BLOCKS (S = 0)
Thread 1: signal(S) → S = 1
Thread 2: unblocks → enters critical section
```

---

## Team

Built for Hackathon Team 7 — demonstrating DAA and OS concepts through competitive game validation.

---

## License

MIT License
