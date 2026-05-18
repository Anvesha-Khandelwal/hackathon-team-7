/**
 * TurnEngine — script.js
 * Full frontend: board rendering, API calls, live analysis,
 * semaphore demo with visual state machine, strategy compare.
 */

/* ── Shorthand ─────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── App State ─────────────────────────────────────────────────── */
let currentPlayer = 'X';
let gameOver      = false;
let moveCount     = 0;
let lastHistory   = [];
let p1Name        = 'Player 1';
let p2Name        = 'Player 2';

/* ══════════════════════════════════════════════════════════════════
   BOARD
   ══════════════════════════════════════════════════════════════════ */

function buildBoard(grid) {
  const boardEl = $('gameBoard');
  boardEl.innerHTML = '';
  grid.forEach((row, r) => {
    row.forEach((val, c) => {
      const cell = document.createElement('div');
      cell.className = 'cell' + (val !== '.' ? ` ${val.toLowerCase()} taken` : '');
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.textContent = val !== '.' ? val : '';
      if (!gameOver && val === '.') cell.addEventListener('click', onCellClick);
      boardEl.appendChild(cell);
    });
  });
}

function initBoard() {
  buildBoard([['.','.','.'],['.','.','.'],['.','.','.']]);
}

async function onCellClick(e) {
  if (gameOver) return;
  await makeMove(+e.currentTarget.dataset.row, +e.currentTarget.dataset.col);
}

/* ══════════════════════════════════════════════════════════════════
   API — GAME
   ══════════════════════════════════════════════════════════════════ */

async function makeMove(row, col) {
  setStatus('PROCESSING', false);
  try {
    const res  = await fetch('/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ row, col }),
    });
    const data = await res.json();

    if (!data.success) {
      flashMsg(data.message, 'warn');
      setStatus('READY', true);
      return;
    }

    gameOver      = data.game_over;
    currentPlayer = data.current_player;
    moveCount     = data.move_count;
    if (data.player1_name) p1Name = data.player1_name;
    if (data.player2_name) p2Name = data.player2_name;

    buildBoard(data.board);
    $('moveCount').textContent  = moveCount;
    $('stateStr').textContent   = data.state_str;
    updatePlayerChips(data.current_player);

    if (data.game_over) {
      const isWin = !!data.winner;
      const winnerName = isWin ? (data.winner === 'X' ? p1Name : p2Name) : null;
      flashMsg(isWin ? `🏆 ${winnerName} wins!` : "🤝 Draw — board full!", isWin ? 'win' : 'draw');
      setStatus(isWin ? `WINNER: ${data.winner}` : 'DRAW', true);
      const ov = $('boardOverlay');
      ov.textContent = isWin ? `${data.winner} WINS!` : 'DRAW';
      ov.classList.remove('hidden');
    } else {
      flashMsg(data.message, '');
      setStatus('READY', true);
    }

    if (data.analysis && Object.keys(data.analysis).length) renderAnalysis(data.analysis);
    await refreshHistory();

  } catch(err) {
    console.error(err);
    setStatus('ERROR', true);
  }
}

async function runAnalysis() {
  try {
    const res  = await fetch('/analysis');
    const data = await res.json();
    renderAnalysis(data);
  } catch(err) { console.error(err); }
}

async function refreshHistory() {
  try {
    const res  = await fetch('/history');
    const data = await res.json();
    lastHistory = data.history || [];
    renderHistoryList(lastHistory);
    renderTimeline(lastHistory);
  } catch(err) { console.error(err); }
}

async function resetGame() {
  setStatus('RESETTING', false);
  try {
    const res  = await fetch('/reset', { method: 'POST' });
    const data = await res.json();

    gameOver = false; moveCount = 0; currentPlayer = 'X';
    if (data.player1_name) p1Name = data.player1_name;
    if (data.player2_name) p2Name = data.player2_name;

    buildBoard(data.board || [['.','.','.'],['.','.','.'],['.','.','.']]);
    $('moveCount').textContent = '0';
    $('stateStr').textContent  = data.state_str || '.........';
    $('gameMessage').textContent  = '';
    $('gameMessage').className    = 'game-message';
    $('boardOverlay').classList.add('hidden');
    updatePlayerChips('X');
    resetAnalysisUI();
    renderHistoryList([]);
    renderTimeline([]);
    setStatus('READY', true);
  } catch(err) { console.error(err); setStatus('ERROR', true); }
}

/* ══════════════════════════════════════════════════════════════════
   ANALYSIS RENDERING
   ══════════════════════════════════════════════════════════════════ */

function renderAnalysis(data) {
  const sim = data.similarity    ?? 0;
  const ed  = data.edit_distance ?? '—';
  const lcs = data.lcs_length    ?? '—';
  const rep = data.repeat_count  ?? 1;

  // Animate similarity meter
  $('simVal').textContent = sim + '%';
  const fill = $('simMeter');
  fill.style.width  = Math.min(sim, 100) + '%';
  fill.className    = 'meter-fill' + (sim >= 80 ? ' danger' : sim >= 50 ? ' warn-fill' : '');

  $('edVal').textContent     = ed;
  $('lcsVal').textContent    = lcs;
  $('repeatVal').textContent = rep;

  // Threefold counter pips
  updateRepeatPips(rep);

  // Alerts
  const drawAlert      = $('drawAlert');
  const threefoldAlert = $('threefoldAlert');

  if (data.threefold) {
    drawAlert.style.display      = 'none';
    threefoldAlert.style.display = 'flex';
  } else if (data.potential_draw) {
    $('drawReason').textContent  = `Similarity ${sim}% ≥ threshold ${data.threshold ?? 80}%`;
    drawAlert.style.display      = 'flex';
    threefoldAlert.style.display = 'none';
  } else {
    drawAlert.style.display      = 'none';
    threefoldAlert.style.display = 'none';
  }
}

function updateRepeatPips(count) {
  const container = $('repeatPips');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const pip = document.createElement('span');
    pip.className = 'repeat-pip' + (i < count ? ' active' + (count >= 3 ? ' danger' : '') : '');
    container.appendChild(pip);
  }
}

function resetAnalysisUI() {
  ['simVal','edVal','lcsVal','repeatVal'].forEach(id => $(id).textContent = '—');
  $('simMeter').style.width = '0%';
  $('simMeter').className   = 'meter-fill';
  $('drawAlert').style.display      = 'none';
  $('threefoldAlert').style.display = 'none';
  updateRepeatPips(0);
}

/* ══════════════════════════════════════════════════════════════════
   HISTORY + TIMELINE
   ══════════════════════════════════════════════════════════════════ */

function renderHistoryList(history) {
  const list = $('historyList');
  if (!history.length) {
    list.innerHTML = '<span class="history-empty">No moves yet</span>';
    return;
  }
  list.innerHTML = history.map((state, i) => {
    const count = history.filter(s => s === state).length;
    const isRep = count >= 3;
    const label = isRep ? ` <span class="rep-badge">×${count} REPEAT</span>` : '';
    return `<div class="history-item${isRep ? ' repeat' : ''}">
      <span class="hist-idx">#${String(i).padStart(2,'0')}</span>
      <span class="hist-state">${state}</span>${label}
    </div>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function renderTimeline(history) {
  const tl = $('timeline');
  if (history.length <= 1) {
    tl.innerHTML = '<span class="log-empty">No moves yet</span>';
    return;
  }
  tl.innerHTML = history.slice(1).map((state, i) => {
    const player = i % 2 === 0 ? 'X' : 'O';
    const name   = player === 'X' ? p1Name : p2Name;
    const diff   = countDiff(history[i], state);
    const pos    = findChangedCell(history[i], state);
    return `<div class="tl-item">
      <span class="tl-index">#${String(i+1).padStart(2,'0')}</span>
      <span class="tl-dot ${player.toLowerCase()}"></span>
      <div class="tl-content">
        <div class="tl-state">${formatState(state)}</div>
        <div class="tl-meta">${name} (${player}) placed at [${pos}]</div>
      </div>
    </div>`;
  }).join('');
  tl.scrollTop = tl.scrollHeight;
}

function countDiff(a, b) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

function findChangedCell(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return `${Math.floor(i/3)},${i%3}`;
  }
  return '?';
}

function formatState(s) {
  const c = s.replace(/ /g, '.').split('');
  return c.slice(0,3).join(' ') + ' │ ' + c.slice(3,6).join(' ') + ' │ ' + c.slice(6,9).join(' ');
}

/* ══════════════════════════════════════════════════════════════════
   PLAYER CHIPS / STATUS
   ══════════════════════════════════════════════════════════════════ */

function updatePlayerChips(nextPlayer) {
  const chipX = $('chipX'), chipO = $('chipO');
  $('nameX').textContent = p1Name;
  $('nameO').textContent = p2Name;

  chipX.classList.toggle('active', nextPlayer === 'X');
  chipO.classList.toggle('active', nextPlayer === 'O');
  $('statusX').textContent = nextPlayer === 'X' ? 'YOUR TURN' : 'WAITING';
  $('statusO').textContent = nextPlayer === 'O' ? 'YOUR TURN' : 'WAITING';

  const name = nextPlayer === 'X' ? p1Name : p2Name;
  $('turnText').textContent = `${name}'s Turn (${nextPlayer})`;
  $('turnDot').style.background = nextPlayer === 'X' ? 'var(--cyan)' : 'var(--gold)';
  $('turnDot').style.boxShadow  = nextPlayer === 'X' ? 'var(--glow-cyan)' : 'var(--glow-gold)';
}

function setStatus(text, ready) {
  $('statusText').textContent  = text;
  $('statusDot').style.background = ready ? 'var(--cyan)' : 'var(--gold)';
  $('statusDot').style.boxShadow  = ready ? 'var(--glow-cyan)' : 'var(--glow-gold)';
}

function flashMsg(msg, cls) {
  $('gameMessage').textContent = msg;
  $('gameMessage').className   = 'game-message ' + (cls || '');
}

/* ══════════════════════════════════════════════════════════════════
   SEMAPHORE DEMO — VISUAL STATE MACHINE
   ══════════════════════════════════════════════════════════════════ */

let semAnimInterval = null;

async function runRaceDemo() {
  const btn = $('raceBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinning">⟳</span> RUNNING…';
  clearSemLog();
  appendSemLog('[ RACE CONDITION DEMO — No Semaphore ]', 'head');
  appendSemLog('Two threads writing SIMULTANEOUSLY — no protection!', 'warn');
  $('verdictRow').style.display = 'none';
  stopSemAnimation();

  // Show race state machine animation
  $('semDiagram').style.display = 'flex';
  startRaceAnimation();

  try {
    const res  = await fetch('/race_condition');
    const data = await res.json();

    stopSemAnimation();
    renderSemLog(data.event_log || [], 'unsafe');

    $('unsafeCard').querySelector('.verdict-text').textContent =
      data.corruption_detected
        ? '💥 CORRUPTED — race condition occurred'
        : 'No corruption this run (non-deterministic)';
    $('safeCard').querySelector('.verdict-text').textContent = '—';

    // Show board state comparison
    if (data.final_board_string) {
      appendSemLog(`Final board: ${data.final_board_string}`, data.corruption_detected ? 'corrupt' : 'safe');
      appendSemLog(data.verdict, data.corruption_detected ? 'corrupt' : 'safe');
    }

    $('verdictRow').style.display = 'grid';
  } catch(err) { appendSemLog('ERROR: ' + err.message, 'corrupt'); }

  btn.disabled = false;
  btn.innerHTML = '⚡ RACE CONDITION';
}

async function runSafeDemo() {
  const btn = $('safeBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinning">⟳</span> RUNNING…';
  clearSemLog();
  appendSemLog('[ SEMAPHORE DEMO — Mutual Exclusion ]', 'head');
  appendSemLog('Semaphore(1) protects the critical section. Only 1 thread at a time.', 'safe');
  $('verdictRow').style.display = 'none';

  $('semDiagram').style.display = 'flex';
  startSafeAnimation();

  try {
    const res  = await fetch('/semaphore_safe');
    const data = await res.json();

    stopSemAnimation();
    renderSemLog(data.event_log || [], 'safe');

    $('safeCard').querySelector('.verdict-text').textContent =
      data.corruption_detected
        ? 'UNEXPECTED corruption!'
        : '✅ SAFE — semaphore enforced mutual exclusion';
    $('unsafeCard').querySelector('.verdict-text').textContent = '—';

    if (data.final_board_string) {
      appendSemLog(`Final board: ${data.final_board_string}`, 'safe');
      appendSemLog(data.verdict, 'safe');
    }

    $('verdictRow').style.display = 'grid';
  } catch(err) { appendSemLog('ERROR: ' + err.message, 'corrupt'); }

  btn.disabled = false;
  btn.innerHTML = '🔒 SEMAPHORE SAFE';
  resetSemDiagram();
}

/* ── Semaphore State Machine Animations ────────────────────── */

function startRaceAnimation() {
  // Race condition: both threads enter simultaneously
  const frames = [
    { t1:'WAITING', t2:'WAITING', lock:'🔓', sem:1, note:'Both threads start' },
    { t1:'RUNNING', t2:'RUNNING', lock:'💥', sem:0, note:'BOTH enter critical section!' },
    { t1:'WRITING', t2:'WRITING', lock:'💥', sem:0, note:'Concurrent write — RACE!' },
    { t1:'DONE',    t2:'DONE',    lock:'🔓', sem:1, note:'Board may be corrupted' },
    { t1:'WAITING', t2:'WAITING', lock:'🔓', sem:1, note:'Repeating…' },
  ];
  runSemFrames(frames, true);
}

function startSafeAnimation() {
  // Semaphore: P1 acquires, P2 blocks, P1 releases, P2 runs
  const frames = [
    { t1:'WAITING', t2:'WAITING', lock:'🔓', sem:1, note:'Both threads ready' },
    { t1:'ACQUIRE', t2:'WAITING', lock:'🔒', sem:0, note:'P1 calls sem.acquire() — P(S)' },
    { t1:'RUNNING', t2:'BLOCKED', lock:'🔒', sem:0, note:'P1 in critical section; P2 blocked' },
    { t1:'WRITING', t2:'BLOCKED', lock:'🔒', sem:0, note:'P1 writes safely' },
    { t1:'RELEASE', t2:'BLOCKED', lock:'🔓', sem:1, note:'P1 calls sem.release() — V(S)' },
    { t1:'DONE',    t2:'ACQUIRE', lock:'🔒', sem:0, note:'P2 unblocked, acquires semaphore' },
    { t1:'DONE',    t2:'RUNNING', lock:'🔒', sem:0, note:'P2 in critical section safely' },
    { t1:'DONE',    t2:'DONE',    lock:'🔓', sem:1, note:'P2 releases — mutual exclusion ✓' },
  ];
  runSemFrames(frames, false);
}

function runSemFrames(frames, loop) {
  stopSemAnimation();
  let step = 0;
  function tick() {
    if (step >= frames.length) {
      if (loop) { step = 0; } else { return; }
    }
    const f = frames[step++];
    setSemState(f.t1, f.t2, f.lock, f.sem, f.note);
  }
  tick();
  semAnimInterval = setInterval(tick, 900);
}

function stopSemAnimation() {
  if (semAnimInterval) { clearInterval(semAnimInterval); semAnimInterval = null; }
}

function setSemState(t1, t2, lock, semVal, note) {
  const t1El = $('t1State'), t2El = $('t2State');
  const lockEl = $('mutexLock'), semValEl = $('semValue'), noteEl = $('semNote');

  t1El.textContent = t1; t1El.className = 'thread-state ' + t1.toLowerCase();
  t2El.textContent = t2; t2El.className = 'thread-state ' + t2.toLowerCase();
  lockEl.textContent = lock;
  if (semValEl) semValEl.textContent = semVal;
  if (noteEl)   noteEl.textContent   = note || '';

  // Highlight lock
  lockEl.style.transform = (t1 === 'ACQUIRE' || t2 === 'ACQUIRE') ? 'scale(1.4)' : 'scale(1)';
}

function resetSemDiagram() {
  setSemState('IDLE', 'IDLE', '🔓', 1, 'Semaphore(1) — Ready');
}

/* ── Semaphore Log Helpers ──────────────────────────────────── */

function clearSemLog() {
  $('logBox').innerHTML = '';
}

function renderSemLog(lines, mode) {
  clearSemLog();
  appendSemLog(`[ ${mode === 'safe' ? 'SEMAPHORE PROTECTED' : 'RACE CONDITION'} — Event Log ]`, 'head');
  lines.forEach(line => appendSemLog(line, classifyLogLine(line)));
}

function classifyLogLine(line) {
  if (line.includes('CORRUPTION') || line.includes('corrupted') || line.includes('💥')) return 'corrupt';
  if (line.includes('⚠'))   return 'warn';
  if (line.includes('✅') || line.includes('🟢') || line.includes('safely') || line.includes('safely')) return 'safe';
  if (line.includes('🔒'))  return 'lock';
  if (line.includes('🔓'))  return 'unlock';
  return '';
}

function appendSemLog(msg, cls) {
  const span = document.createElement('span');
  span.className = 'log-line ' + (cls || '');
  span.textContent = msg;
  $('logBox').appendChild(span);
  $('logBox').scrollTop = $('logBox').scrollHeight;
}

/* ══════════════════════════════════════════════════════════════════
   STRATEGY COMPARE
   ══════════════════════════════════════════════════════════════════ */

async function runStrategyCompare() {
  $('stratBtn').innerHTML = '<span class="spinning">⟳</span> COMPARING…';
  try {
    const res  = await fetch('/strategy_compare');
    const data = await res.json();

    if (data.player1_name) $('stratNameX').textContent = data.player1_name;
    if (data.player2_name) $('stratNameO').textContent = data.player2_name;

    $('xMoves').textContent = formatMoveStr(data.player_x_moves || '—');
    $('oMoves').textContent = formatMoveStr(data.player_o_moves || '—');

    const hasSim = data.similarity !== null && data.similarity !== undefined;
    $('stratSim').textContent = hasSim ? data.similarity + '%' : '—';
    $('stratEd').textContent  = 'EDIT DIST: ' + (hasSim ? (data.edit_distance ?? '—') : '—');

    // Animate similarity bar
    const bar = $('stratBar');
    if (bar && hasSim) {
      bar.style.width = Math.min(data.similarity, 100) + '%';
      bar.className = 'meter-fill' + (data.similarity >= 80 ? ' danger' : data.similarity >= 50 ? ' warn-fill' : '');
    }

    const rep = $('stratReport');
    rep.textContent = data.report || '—';
    rep.className   = 'strat-report';
    if (data.report?.includes('Very Similar'))  rep.classList.add('similar');
    else if (data.report?.includes('Moderately')) rep.classList.add('moderate');
    else if (data.report?.includes('Distinct'))   rep.classList.add('distinct');

  } catch(err) { console.error(err); }
  $('stratBtn').innerHTML = 'COMPARE ▶';
}

function formatMoveStr(s) {
  if (!s || s === '—') return '—';
  return s.match(/.{1,2}/g)?.join(' · ') || s;
}

/* ══════════════════════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════════════════════ */

async function logout() {
  try {
    const res  = await fetch('/logout', { method: 'POST' });
    const data = await res.json();
    if (data.redirect) window.location.href = data.redirect;
  } catch { window.location.href = '/login'; }
}

/* ══════════════════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════════════════ */

$('resetBtn').addEventListener('click', resetGame);
$('analyseBtn').addEventListener('click', runAnalysis);
$('historyBtn').addEventListener('click', refreshHistory);
$('raceBtn').addEventListener('click', runRaceDemo);
$('safeBtn').addEventListener('click', runSafeDemo);
$('stratBtn').addEventListener('click', runStrategyCompare);
$('logoutBtn').addEventListener('click', logout);

/* ══════════════════════════════════════════════════════════════════
   INIT — fetch state on load / reload
   ══════════════════════════════════════════════════════════════════ */

(async () => {
  initBoard();
  resetSemDiagram();
  try {
    const res  = await fetch('/state');
    const data = await res.json();
    if (data.player1_name) p1Name = data.player1_name;
    if (data.player2_name) p2Name = data.player2_name;
    buildBoard(data.board);
    moveCount     = data.move_count;
    gameOver      = data.game_over;
    currentPlayer = data.current_player;
    $('moveCount').textContent = moveCount;
    $('stateStr').textContent  = data.state_str;
    updatePlayerChips(data.current_player);
    if (moveCount > 0) {
      await runAnalysis();
      await refreshHistory();
    }
  } catch(_) { /* server not ready */ }
  setStatus('READY', true);
})();
