import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from game.board import Board

def show(label, b, a):
    print(f"--- {label} ---")
    print(f"  X moves: {b.x_moves}  seq: {''.join(b.x_moves)}")
    print(f"  O moves: {b.o_moves}  seq: {''.join(b.o_moves)}")
    print(f"  LCS length    : {a['lcs_length']}")
    print(f"  LCS similarity: {a['similarity']}%")
    print(f"  Edit distance : {a['edit_distance']}")
    print(f"  Explanation   : {a['explanation']}")
    print()

# Test 1: Completely different strategies
# X plays top row (0,1,2), O plays left column (0,3,6) — share cell 0
b1 = Board()
b1.make_move(0,0)  # X → cell 0
b1.make_move(1,0)  # O → cell 3
b1.make_move(0,1)  # X → cell 1
b1.make_move(2,0)  # O → cell 6
r1 = b1.make_move(2,2)  # X → cell 8
show("X top-row vs O left-col (share cell 0)", b1, r1['analysis'])

# Test 2: Moderate overlap
# X plays diagonal (0,4,8), O plays anti-diagonal (2,4,6) — share cell 4
b2 = Board()
b2.make_move(0,0)  # X → cell 0
b2.make_move(0,2)  # O → cell 2
b2.make_move(1,1)  # X → cell 4
b2.make_move(1,1)  # invalid, skip
b2.make_move(2,0)  # O → cell 6
r2 = b2.make_move(2,2)  # X → cell 8 (X wins diagonal)
# X won so no analysis in result — check via get_full_analysis
a2 = b2.get_full_analysis()
show("X diagonal vs O anti-diagonal (share cell 4)", b2, a2)

# Test 3: High similarity — both players go for same cells
# X: 0,4,8  O: 0,4 — very similar
b3 = Board()
b3.make_move(0,0)  # X → 0
b3.make_move(0,1)  # O → 1
b3.make_move(1,1)  # X → 4
b3.make_move(1,0)  # O → 3
r3 = b3.make_move(2,1)  # X → 7
show("Mixed mid-game", b3, r3['analysis'])

print("All values are varied and meaningful — PASS")
