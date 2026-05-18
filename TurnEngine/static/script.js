/* script.js — TurnEngine Frontend Logic */

// ── State ─────────────────────────────────────────────────────────────────
let currentPlayer = 'X';
let gameOver = false;

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildBoard();
  fetchState();
});

// ── Build Board ───────────────────────────────────────────────────────────
function buildBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.addEventListener('click', () => onCellClick(i));
    board.appendChild(cell);
  }
}

// ── Cell Click ────────────────────────────────────────────────────────────
async function onCellClick(index) {
  if (gameOver) return;
  const row = Math.floor(index / 3);
  const col = index % 3;

  try {
    const res  = await fetch('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col }),
    });
    const data = await res.json();
    handleMoveResponse(data);
  } catch (e) {
    setStatus('Connection error. Is the server running?', 'error');
  }
}

// ── Handle Move Response ──────────────────────────────────────────────────
function handleMoveResponse(data) {
  if (!data.success) {
    setStatus(data.message, 'error');
    return;
  }

  renderBoard(data.board);
  currentPlayer = data.current_player;
  gameOver      = data.game_over;

  // Status message
  if (data.winner) {
    setStatus(`🏆 Player ${data.winner} wins!`, 'success');
    setTurn(`Player ${data.winner} Wins!`);
  } else if (data.game_over && data.draw && !data.analysis?.potential_draw) {
    setStatus("🤝 It's a draw — board is full!", 'warning');
    setTurn("Draw!");
  } else {
    setStatus(data.message, data.analysis?.potential_draw ? 'warning' : '');
    if (!gameOver) setTurn(`Player ${currentPlayer}'s Turn`);
  }

  // Analysis
  if (data.analysis && Object.keys(data.analysis).length > 0) {
    updateAnalysis(data.analysis);
  }
}

// ── Render Board ──────────────────────────────────────────────────────────
function renderBoard(grid) {
  const cells = document.querySelectorAll('.cell');
  cells.forEach((cell, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const val = grid[row][col];
    cell.textContent = val === '.' ? '' : val;
    cell.className   = 'cell';
    if (val !== '.') {
      cell.classList.add('taken', val.toLowerCase());
    }
  });
}

// ── Update Analysis Panel ─────────────────────────────────────────────────
function updateAnalysis(a) {
  document.getElementById('lcsVal').textContent    = a.lcs_length    ?? '—';
  document.getElementById('simVal').textContent    = a.similarity != null ? a.similarity + '%' : '—';
  document.getElementById('editVal').textContent   = a.edit_distance ?? '—';
  document.getElementById('repeatVal').textContent = a.repeat_count  ?? '—';

  const alert = document.getElementById('drawAlert');
  if (a.potential_draw) {
    alert.classList.remove('hidden');
  } else {
    alert.classList.add('hidden');
  }
}

// ── Check Similarity (manual button) ─────────────────────────────────────
async function checkSimilarity() {
  try {
    const res  = await fetch('/analysis');
    const data = await res.json();

    if (Object.keys(data).length === 0) {
      setStatus('Not enough moves to analyse yet.', 'warning');
      return;
    }

    updateAnalysis(data);

    // Also refresh history
    const hRes  = await fetch('/history');
    const hData = await hRes.json();
    renderHistory(hData.history);

    setStatus(`Analysis updated — Similarity: ${data.similarity}%, Edit Distance: ${data.edit_distance}`, '');
  } catch (e) {
    setStatus('Could not fetch analysis.', 'error');
  }
}

// ── Render State History ──────────────────────────────────────────────────
function renderHistory(history) {
  const list = document.getElementById('historyList');
  if (!history || history.length === 0) {
    list.innerHTML = '<span class="history-empty">No moves yet</span>';
    return;
  }
  list.innerHTML = history.map((s, i) =>
    `<span class="history-tag" title="Move ${i}">${s}</span>`
  ).join('');
}

// ── Reset Game ────────────────────────────────────────────────────────────
async function resetGame() {
  try {
    const res  = await fetch('/reset', { method: 'POST' });
    const data = await res.json();

    gameOver      = false;
    currentPlayer = 'X';

    renderBoard(data.board);
    setStatus('Game reset. Player X goes first!', 'success');
    setTurn("Player X's Turn");

    // Clear analysis
    document.getElementById('lcsVal').textContent    = '—';
    document.getElementById('simVal').textContent    = '—';
    document.getElementById('editVal').textContent   = '—';
    document.getElementById('repeatVal').textContent = '—';
    document.getElementById('drawAlert').classList.add('hidden');
    document.getElementById('historyList').innerHTML = '<span class="history-empty">No moves yet</span>';
  } catch (e) {
    setStatus('Could not reset game.', 'error');
  }
}

// ── Run Semaphore Demo ────────────────────────────────────────────────────
async function runSemaphore() {
  const terminal = document.getElementById('terminal');
  terminal.innerHTML = '<span class="term-line info">Running semaphore demo...</span>';

  try {
    const res  = await fetch('/semaphore_demo', { method: 'POST' });
    const data = await res.json();

    if (!data.success) {
      terminal.innerHTML = `<span class="term-line unsafe">Error: ${data.message}</span>`;
      return;
    }

    terminal.innerHTML = '';
    data.log.forEach((line, i) => {
      setTimeout(() => {
        const span = document.createElement('span');
        span.className = 'term-line';

        if (line.includes('WITHOUT') || line.includes('Race')) {
          span.classList.add('unsafe');
        } else if (line.includes('WITH') || line.includes('safely') || line.includes('Safe')) {
          span.classList.add('safe');
        } else if (line.startsWith('===')) {
          span.classList.add('section');
        } else {
          span.classList.add('info');
        }

        span.textContent = line || '\u00A0';
        terminal.appendChild(span);
        terminal.scrollTop = terminal.scrollHeight;
      }, i * 80);
    });
  } catch (e) {
    terminal.innerHTML = '<span class="term-line unsafe">Connection error.</span>';
  }
}

// ── Fetch Initial State ───────────────────────────────────────────────────
async function fetchState() {
  try {
    const res  = await fetch('/state');
    const data = await res.json();
    renderBoard(data.board);
    currentPlayer = data.current_player;
    gameOver      = data.game_over;
    setTurn(`Player ${currentPlayer}'s Turn`);
  } catch (e) {
    // Server not ready yet
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  const box = document.getElementById('statusBox');
  box.textContent  = msg;
  box.className    = 'status-box' + (type ? ' ' + type : '');
}

function setTurn(msg) {
  document.getElementById('turnIndicator').textContent = msg;
}