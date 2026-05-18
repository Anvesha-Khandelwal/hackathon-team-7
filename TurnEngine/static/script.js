/**
 * TurnEngine – script.js
 * Full frontend: board, API calls, analysis, semaphore demo, strategy compare.
 */

/* ── Shorthand ─────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

/* ── State ─────────────────────────────────────────────────────────── */
let currentPlayer = 'X';
let gameOver      = false;
let moveCount     = 0;
let lastHistory   = [];

/* ── DOM refs ──────────────────────────────────────────────────────── */
const boardEl      = $('gameBoard');
const moveCountEl  = $('moveCount');
const stateStrEl   = $('stateStr');
const gameMsgEl    = $('gameMessage');
const statusTextEl = $('statusText');
const statusDotEl  = $('statusDot');
const turnTextEl   = $('turnText');
const turnDotEl    = $('turnDot');

/* ══════════════════════════════════════════════════════════════════════
   BOARD
   ══════════════════════════════════════════════════════════════════════ */

function buildBoard(grid) {
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

/* ══════════════════════════════════════════════════════════════════════
   API CALLS
   ══════════════════════════════════════════════════════════════════════ */

async function makeMove(row, col) {
  setStatus('PROCESSING', false);
  try {
    const res  = await fetch('/move', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({row, col}),
    });
    const data = await res.json();

    if (!data.success) { flashMsg(data.message, ''); setStatus('READY', true); return; }

    gameOver      = data.game_over;
    currentPlayer = data.current_player;
    moveCount     = data.move_count;

    buildBoard(data.board);
    moveCountEl.textContent = moveCount;
    stateStrEl.textContent  = data.state_str;
    updatePlayerChips(data.current_player, data.player1_name, data.player2_name);

    if (data.game_over) {
      const isWin = !!data.winner;
      flashMsg(data.message, isWin ? 'win' : 'draw');
      setStatus(isWin ? 'WINNER: ' + data.winner : 'DRAW', true);
      $('boardOverlay').textContent = data.message;
      $('boardOverlay').classList.remove('hidden');
    } else {
      flashMsg(data.message, '');
      setStatus('READY', true);
    }

    if (data.analysis && Object.keys(data.analysis).length) renderAnalysis(data.analysis);
    await refreshHistory();

  } catch(err) { console.error(err); setStatus('ERROR', true); }
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
    const res  = await fetch('/reset', {method:'POST'});
    const data = await res.json();
    gameOver = false; moveCount = 0; currentPlayer = 'X';
    buildBoard(data.board || [['.','.','.'],['.','.','.'],['.','.','.']]);
    moveCountEl.textContent = '0';
    stateStrEl.textContent  = data.state_str || '.........';
    gameMsgEl.textContent   = '';
    gameMsgEl.className     = 'game-message';
    $('boardOverlay').classList.add('hidden');
    updatePlayerChips('X', data.player1_name, data.player2_name);
    resetAnalysisUI();
    renderHistoryList([]);
    renderTimeline([]);
    setStatus('READY', true);
  } catch(err) { console.error(err); setStatus('ERROR', true); }
}

/* ══════════════════════════════════════════════════════════════════════
   ANALYSIS RENDERING
   ══════════════════════════════════════════════════════════════════════ */

function renderAnalysis(data) {
  const sim = data.similarity  ?? 0;
  const ed  = data.edit_distance ?? '—';
  const lcs = data.lcs_length   ?? '—';
  const rep = data.repeat_count ?? 1;

  $('simVal').textContent  = sim + '%';
  const fill = $('simMeter');
  fill.style.width = sim + '%';
  fill.className   = 'meter-fill' + (sim >= 80 ? ' danger' : '');

  $('edVal').textContent     = ed;
  $('lcsVal').textContent    = lcs;
  $('repeatVal').textContent = rep;

  $('drawAlert').style.display      = (data.potential_draw && !data.threefold) ? 'flex' : 'none';
  $('threefoldAlert').style.display = data.threefold ? 'flex' : 'none';

  if (data.potential_draw && !data.threefold) {
    $('drawReason').textContent = `Similarity ${sim}% ≥ threshold ${data.threshold ?? 80}%`;
  }
}

function resetAnalysisUI() {
  ['simVal','edVal','lcsVal','repeatVal'].forEach(id => $(id).textContent = '—');
  $('simMeter').style.width = '0%';
  $('simMeter').className   = 'meter-fill';
  $('drawAlert').style.display      = 'none';
  $('threefoldAlert').style.display = 'none';
}

/* ══════════════════════════════════════════════════════════════════════
   HISTORY + TIMELINE
   ══════════════════════════════════════════════════════════════════════ */

function renderHistoryList(history) {
  const list = $('historyList');
  if (!history.length) { list.innerHTML = '<span class="history-empty">No moves yet</span>'; return; }
  list.innerHTML = history.map((state, i) => {
    const count = history.filter(s => s === state).length;
    const isRep = count >= 3;
    return `<div class="history-item${isRep ? ' repeat' : ''}">#${String(i).padStart(2,'0')} ${state}${isRep ? ' ← ×' + count : ''}</div>`;
  }).join('');
  list.scrollTop = list.scrollHeight;
}

function renderTimeline(history) {
  const tl = $('timeline');
  if (history.length <= 1) { tl.innerHTML = '<span class="log-empty">No moves yet</span>'; return; }
  tl.innerHTML = history.slice(1).map((state, i) => {
    const player = i % 2 === 0 ? 'X' : 'O';
    const diff   = countDiff(history[i], state);
    return `<div class="tl-item">
      <span class="tl-index">#${String(i+1).padStart(2,'0')}</span>
      <span class="tl-dot ${player.toLowerCase()}"></span>
      <div class="tl-content">
        <div class="tl-state">${formatState(state)}</div>
        <div class="tl-meta">Player ${player} · Δ${diff} cell${diff!==1?'s':''}</div>
      </div></div>`;
  }).join('');
  tl.scrollTop = tl.scrollHeight;
}

function countDiff(a, b) { let n=0; for(let i=0;i<a.length;i++) if(a[i]!==b[i]) n++; return n; }
function formatState(s) {
  const c = s.replace(/ /g,'.').split('');
  return c.slice(0,3).join(' ')+' │ '+c.slice(3,6).join(' ')+' │ '+c.slice(6,9).join(' ');
}

/* ══════════════════════════════════════════════════════════════════════
   PLAYER CHIPS / STATUS
   ══════════════════════════════════════════════════════════════════════ */

function updatePlayerChips(nextPlayer, p1Name, p2Name) {
  const chipX = $('chipX'), chipO = $('chipO');
  if (p1Name) $('nameX').textContent = p1Name;
  if (p2Name) $('nameO').textContent = p2Name;

  chipX.classList.toggle('active', nextPlayer === 'X');
  chipO.classList.toggle('active', nextPlayer === 'O');
  $('statusX').textContent = nextPlayer === 'X' ? 'YOUR TURN' : 'WAITING';
  $('statusO').textContent = nextPlayer === 'O' ? 'YOUR TURN' : 'WAITING';

  const name = nextPlayer === 'X' ? (p1Name || 'Player 1') : (p2Name || 'Player 2');
  turnTextEl.textContent = `${name}'s Turn (${nextPlayer})`;
  turnDotEl.style.background = nextPlayer === 'X' ? 'var(--cyan)' : 'var(--gold)';
  turnDotEl.style.boxShadow  = nextPlayer === 'X' ? 'var(--glow-cyan)' : 'var(--glow-gold)';
}

function setStatus(text, ready) {
  statusTextEl.textContent  = text;
  statusDotEl.style.background = ready ? 'var(--cyan)' : 'var(--gold)';
  statusDotEl.style.boxShadow  = ready ? 'var(--glow-cyan)' : 'var(--glow-gold)';
}

function flashMsg(msg, cls) {
  gameMsgEl.textContent = msg;
  gameMsgEl.className   = 'game-message ' + cls;
}

/* ══════════════════════════════════════════════════════════════════════
   SEMAPHORE DEMO
   ══════════════════════════════════════════════════════════════════════ */

async function runRaceDemo() {
  $('raceBtn').disabled = true;
  $('raceBtn').innerHTML = '<span class="spinning">⟳</span> RUNNING…';
  $('logBox').innerHTML  = '<span class="log-line head">[ RACE CONDITION DEMO – No Semaphore ]</span>';
  $('verdictRow').style.display = 'none';
  $('semDiagram').style.display = 'none';

  try {
    const res  = await fetch('/race_condition');
    const data = await res.json();
    renderLog(data.event_log || [], 'unsafe');
    $('unsafeText').textContent = data.corruption_detected
      ? 'CORRUPTED — race condition occurred'
      : 'No corruption this run (non-deterministic)';
    $('safeText').textContent = '—';
    $('verdictRow').style.display = 'grid';
  } catch(err) { appendLog('ERROR: ' + err.message, 'warn'); }

  $('raceBtn').disabled = false;
  $('raceBtn').innerHTML = '⚡ RACE CONDITION';
}

async function runSafeDemo() {
  $('safeBtn').disabled = true;
  $('safeBtn').innerHTML = '<span class="spinning">⟳</span> RUNNING…';
  $('logBox').innerHTML  = '<span class="log-line head">[ SEMAPHORE DEMO – Mutual Exclusion ]</span>';
  $('verdictRow').style.display = 'none';
  $('semDiagram').style.display = 'flex';
  animateSemDiagram();

  try {
    const res  = await fetch('/semaphore_safe');
    const data = await res.json();
    renderLog(data.event_log || [], 'safe');
    $('safeText').textContent = data.corruption_detected
      ? 'UNEXPECTED corruption!'
      : 'SAFE — semaphore enforced mutual exclusion';
    $('unsafeText').textContent = '—';
    $('verdictRow').style.display = 'grid';
  } catch(err) { appendLog('ERROR: ' + err.message, 'warn'); }

  $('safeBtn').disabled = false;
  $('safeBtn').innerHTML = '🔒 SEMAPHORE SAFE';
  resetSemDiagram();
}

function renderLog(lines, mode) {
  const box = $('logBox');
  box.innerHTML = `<span class="log-line head">[ ${mode === 'safe' ? 'SEMAPHORE' : 'RACE CONDITION'} – Event Log ]</span>`;
  lines.forEach(line => {
    const span = document.createElement('span');
    span.className = 'log-line';
    if (line.includes('CORRUPTION') || line.includes('corrupted')) span.classList.add('corrupt');
    else if (line.includes('⚠'))   span.classList.add('warn');
    else if (line.includes('✅') || line.includes('🟢') || line.includes('safely')) span.classList.add('safe');
    span.textContent = line;
    box.appendChild(span);
  });
  box.scrollTop = box.scrollHeight;
}

function appendLog(msg, cls) {
  const span = document.createElement('span');
  span.className = 'log-line ' + (cls||'');
  span.textContent = msg;
  $('logBox').appendChild(span);
  $('logBox').scrollTop = $('logBox').scrollHeight;
}

function animateSemDiagram() {
  let step = 0;
  const states = [
    {t1:'WAITING', t2:'WAITING', lock:'🔓'},
    {t1:'RUNNING', t2:'WAITING', lock:'🔒'},
    {t1:'RUNNING', t2:'BLOCKED', lock:'🔒'},
    {t1:'IDLE',    t2:'RUNNING', lock:'🔒'},
    {t1:'IDLE',    t2:'IDLE',    lock:'🔓'},
  ];
  const iv = setInterval(() => {
    if (step >= states.length) { clearInterval(iv); return; }
    const s = states[step++];
    $('t1State').textContent = s.t1; $('t1State').className = 'thread-state ' + s.t1.toLowerCase();
    $('t2State').textContent = s.t2; $('t2State').className = 'thread-state ' + s.t2.toLowerCase();
    $('mutexLock').textContent = s.lock;
  }, 800);
}

function resetSemDiagram() {
  ['t1State','t2State'].forEach(id => { $(id).textContent = 'IDLE'; $(id).className = 'thread-state'; });
  $('mutexLock').textContent = '🔓';
}

/* ══════════════════════════════════════════════════════════════════════
   STRATEGY COMPARE
   ══════════════════════════════════════════════════════════════════════ */

async function runStrategyCompare() {
  $('stratBtn').innerHTML = '<span class="spinning">⟳</span>';
  try {
    const res  = await fetch('/strategy_compare');
    const data = await res.json();

    if (data.player1_name) { $('stratNameX').textContent = data.player1_name; }
    if (data.player2_name) { $('stratNameO').textContent = data.player2_name; }

    $('xMoves').textContent = formatMoveStr(data.player_x_moves || '—');
    $('oMoves').textContent = formatMoveStr(data.player_o_moves || '—');

    if (data.similarity !== null && data.similarity !== undefined) {
      $('stratSim').textContent = data.similarity + '%';
      $('stratEd').textContent  = 'EDIT DIST: ' + (data.edit_distance ?? '—');
    } else {
      $('stratSim').textContent = '—';
      $('stratEd').textContent  = 'EDIT DIST: —';
    }

    const rep = $('stratReport');
    rep.textContent = data.report || '—';
    rep.className = 'strat-report';
    if (data.report?.includes('Very Similar'))  rep.classList.add('similar');
    else if (data.report?.includes('Moderately')) rep.classList.add('moderate');
    else if (data.report?.includes('Distinct'))   rep.classList.add('distinct');

  } catch(err) { console.error(err); }
  $('stratBtn').innerHTML = 'COMPARE ▶';
}

function formatMoveStr(s) {
  if (!s || s === '—') return '—';
  return s.match(/.{1,2}/g)?.join('·') || s;
}

/* ══════════════════════════════════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════════════════════════════════ */

async function logout() {
  try {
    const res  = await fetch('/logout', {method:'POST'});
    const data = await res.json();
    if (data.redirect) window.location.href = data.redirect;
  } catch(err) { window.location.href = '/login'; }
}

/* ══════════════════════════════════════════════════════════════════════
   EVENT LISTENERS
   ══════════════════════════════════════════════════════════════════════ */

$('resetBtn').addEventListener('click', resetGame);
$('analyseBtn').addEventListener('click', runAnalysis);
$('historyBtn').addEventListener('click', refreshHistory);
$('raceBtn').addEventListener('click', runRaceDemo);
$('safeBtn').addEventListener('click', runSafeDemo);
$('stratBtn').addEventListener('click', runStrategyCompare);
$('logoutBtn').addEventListener('click', logout);

/* ══════════════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════════════ */

(async () => {
  initBoard();
  try {
    const res  = await fetch('/state');
    const data = await res.json();
    buildBoard(data.board);
    moveCount     = data.move_count;
    gameOver      = data.game_over;
    currentPlayer = data.current_player;
    moveCountEl.textContent = moveCount;
    stateStrEl.textContent  = data.state_str;
    updatePlayerChips(data.current_player, data.player1_name, data.player2_name);
    if (moveCount > 0) { await runAnalysis(); await refreshHistory(); }
  } catch(_) { /* server warming up */ }
  setStatus('READY', true);
})();