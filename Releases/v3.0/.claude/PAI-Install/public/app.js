/**
 * PAI Installer v3.0 — Frontend Application
 * Vanilla JavaScript — no framework dependencies.
 * Handles WebSocket communication, UI rendering, and state management.
 */

// ─── State ───────────────────────────────────────────────────────

let ws = null;
let connected = false;
let voiceEnabled = true;
let currentAudio = null;
let steps = [
  { id: 'system-detect', name: 'System Detection', number: 1, status: 'pending' },
  { id: 'prerequisites', name: 'Prerequisites', number: 2, status: 'pending' },
  { id: 'api-keys', name: 'API Keys', number: 3, status: 'pending' },
  { id: 'identity', name: 'Identity', number: 4, status: 'pending' },
  { id: 'repository', name: 'PAI Repository', number: 5, status: 'pending' },
  { id: 'configuration', name: 'Configuration', number: 6, status: 'pending' },
  { id: 'voice', name: 'DA Voice', number: 7, status: 'pending' },
  { id: 'validation', name: 'Validation', number: 8, status: 'pending' },
];

// ─── WebSocket Connection ────────────────────────────────────────

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws`);

  ws.onopen = () => {
    connected = true;
    ws.send(JSON.stringify({ type: 'client_ready' }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    connected = false;
    addMessage('system', 'Connection lost. Reconnecting...', false);
    setTimeout(connect, 2000); // Auto-reconnect
  };

  ws.onerror = () => {
    connected = false;
  };
}

// ─── Message Handler ─────────────────────────────────────────────

function handleServerMessage(msg) {
  const isReplayed = msg.replayed === true;

  switch (msg.type) {
    case 'connected':
      break;

    case 'step_update':
      updateStep(msg.step, msg.status);
      updateProgress();
      break;

    case 'detection_result':
      renderDetection(msg.data);
      break;

    case 'message':
      addMessage(msg.role || 'assistant', msg.content, isReplayed);
      if (msg.speak && !isReplayed && voiceEnabled) {
        // TTS would go here if we had the ElevenLabs key
      }
      break;

    case 'input_request':
      renderInputForm(msg.id, msg.prompt, msg.inputType, msg.placeholder);
      break;

    case 'choice_request':
      renderChoiceForm(msg.id, msg.prompt, msg.choices);
      break;

    case 'progress':
      renderProgress(msg.step, msg.percent, msg.detail);
      break;

    case 'validation_result':
      renderValidation(msg.checks);
      break;

    case 'install_complete':
      renderSummary(msg.summary);
      break;

    case 'error':
      addMessage('error', `Error: ${msg.message}`, isReplayed);
      break;
  }

  scrollToBottom();
}

// ─── Step Management ─────────────────────────────────────────────

function updateStep(stepId, status) {
  const step = steps.find(s => s.id === stepId);
  if (step) step.status = status;
  renderSteps();
}

function updateProgress() {
  const done = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const pct = Math.round((done / steps.length) * 100);

  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  const sidebarFill = document.getElementById('sidebar-progress-fill');
  const sidebarText = document.getElementById('sidebar-progress-text');

  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `Step ${done}/${steps.length}`;
  if (sidebarFill) sidebarFill.style.width = pct + '%';
  if (sidebarText) sidebarText.textContent = `Progress: ${pct}%`;
}

function renderSteps() {
  const list = document.getElementById('step-list');
  if (!list) return;

  list.innerHTML = steps.map(s => {
    let icon = '○';
    let cls = s.status;
    if (s.status === 'completed') icon = '✓';
    else if (s.status === 'active') icon = '→';
    else if (s.status === 'skipped') icon = '–';
    else if (s.status === 'failed') icon = '✗';

    return `<li class="step-item ${cls}">
      <span class="step-icon ${cls}">${icon}</span>
      <span class="step-label">${s.number}. ${s.name}</span>
    </li>`;
  }).join('');
}

// ─── Chat Rendering ──────────────────────────────────────────────

function addMessage(role, content, replayed) {
  if (!content || !content.trim()) return;
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = content;
  if (replayed) div.style.animation = 'none';
  chat.appendChild(div);
}

function renderDetection(data) {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  const items = [
    { icon: 'check', label: 'OS', value: data.os?.name + ' (' + data.os?.arch + ')' },
    { icon: 'check', label: 'Shell', value: data.shell?.name },
    { icon: data.tools?.bun?.installed ? 'check' : 'cross', label: 'Bun', value: data.tools?.bun?.installed ? 'v' + data.tools.bun.version : 'Not found' },
    { icon: data.tools?.git?.installed ? 'check' : 'cross', label: 'Git', value: data.tools?.git?.installed ? 'v' + data.tools.git.version : 'Not found' },
    { icon: data.tools?.claude?.installed ? 'check' : 'info', label: 'Claude Code', value: data.tools?.claude?.installed ? 'v' + data.tools.claude.version : 'Will install' },
    { icon: 'info', label: 'Timezone', value: data.timezone },
    { icon: data.existing?.paiInstalled ? 'info' : 'check', label: 'Existing PAI', value: data.existing?.paiInstalled ? 'v' + (data.existing.paiVersion || '?') : 'Fresh install' },
    { icon: data.existing?.hasApiKeys ? 'check' : 'info', label: 'ElevenLabs Key', value: data.existing?.elevenLabsKeyFound ? 'Found' : 'Not found' },
  ];

  const grid = document.createElement('div');
  grid.className = 'detection-grid';
  grid.innerHTML = items.map(i =>
    `<div class="detection-item">
      <span class="${i.icon}">${i.icon === 'check' ? '✓' : i.icon === 'cross' ? '✗' : 'ℹ'}</span>
      <span>${i.label}: ${i.value}</span>
    </div>`
  ).join('');
  chat.appendChild(grid);
}

function renderInputForm(requestId, prompt, inputType, placeholder) {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  // Show prompt as message
  addMessage('assistant', prompt);

  const form = document.createElement('div');
  form.className = 'inline-form';
  form.innerHTML = `
    <label>${inputType === 'key' ? 'API Key' : 'Input'}</label>
    <div class="form-row">
      <input class="inline-input" type="${inputType === 'key' || inputType === 'password' ? 'password' : 'text'}"
             placeholder="${placeholder || ''}" id="input-${requestId}" autocomplete="off">
      <button class="inline-btn" onclick="submitInput('${requestId}')">Submit</button>
    </div>
  `;
  chat.appendChild(form);

  // Focus input
  setTimeout(() => {
    const input = document.getElementById('input-' + requestId);
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitInput(requestId);
      });
    }
  }, 100);

  scrollToBottom();
}

function submitInput(requestId) {
  const input = document.getElementById('input-' + requestId);
  if (!input) return;

  const value = input.value.trim();
  if (!value && input.getAttribute('type') === 'password') {
    // Allow empty for optional fields
  }

  // Mask key display
  const display = value.startsWith('sk-') || value.startsWith('xi-')
    ? value.substring(0, 8) + '...'
    : value;
  addMessage('user', display || '(empty)');

  // Disable form
  input.disabled = true;
  input.closest('.inline-form').querySelector('.inline-btn').disabled = true;

  ws.send(JSON.stringify({ type: 'user_input', requestId, value }));
  scrollToBottom();
}

function renderChoiceForm(requestId, prompt, choices) {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  addMessage('assistant', prompt);

  // Voice preview audio map — show previews for both initial and retry voice selection
  const voicePreviews = { female: '/assets/voice-female.mp3', male: '/assets/voice-male.mp3' };
  const isVoiceTypeRequest = requestId === 'voice-type' || requestId === 'voice-type-retry';

  const group = document.createElement('div');
  group.className = 'choice-group';

  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.requestId = requestId;
    btn.dataset.value = c.value;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'choice-label';
    labelSpan.textContent = c.label;
    btn.appendChild(labelSpan);

    if (c.description) {
      const descSpan = document.createElement('span');
      descSpan.className = 'choice-desc';
      descSpan.textContent = c.description;
      btn.appendChild(descSpan);
    }

    if (voicePreviews[c.value] && isVoiceTypeRequest) {
      const preview = document.createElement('span');
      preview.className = 'preview-btn';
      preview.innerHTML = '&#9654; Preview';
      preview.addEventListener('click', (e) => {
        e.stopPropagation();
        playPreview(voicePreviews[c.value], preview);
      });
      btn.appendChild(preview);
    }

    btn.addEventListener('click', () => submitChoice(requestId, c.value, btn));
    group.appendChild(btn);
  });

  chat.appendChild(group);
  scrollToBottom();
}

function playPreview(src, btn) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  currentAudio = new Audio(src);
  currentAudio.volume = 0.8;
  currentAudio.play().catch(() => {});
  btn.textContent = '⏹ Playing';
  currentAudio.onended = () => { btn.textContent = '▶ Preview'; currentAudio = null; };
}

function submitChoice(requestId, value, btn) {
  // Highlight selected, disable all
  const group = btn.closest('.choice-group');
  group.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    b.style.opacity = b === btn ? '1' : '0.4';
  });
  btn.style.borderColor = 'var(--accent-primary)';

  // Extract only the label text, not description or preview button text
  const labelEl = btn.querySelector('.choice-label');
  const displayText = labelEl ? labelEl.textContent.trim() : btn.textContent.trim().split('\n')[0];
  addMessage('user', displayText);
  ws.send(JSON.stringify({ type: 'user_choice', requestId, value }));
  scrollToBottom();
}

function renderProgress(step, percent, detail) {
  // Update or create progress indicator
  let existing = document.getElementById('progress-' + step);
  const chat = document.getElementById('chat-messages');

  if (existing) {
    existing.querySelector('.mini-fill').style.width = percent + '%';
    existing.querySelector('.prog-detail').textContent = detail;
  } else {
    const div = document.createElement('div');
    div.className = 'progress-msg';
    div.id = 'progress-' + step;
    div.innerHTML = `
      <div class="spinner"></div>
      <div class="mini-bar"><div class="mini-fill" style="width:${percent}%"></div></div>
      <span class="prog-detail">${detail}</span>
    `;
    chat.appendChild(div);
  }
  scrollToBottom();
}

function renderValidation(checks) {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  addMessage('system', 'Running validation checks...');

  const list = document.createElement('div');
  list.className = 'validation-list';
  list.innerHTML = checks.map(c =>
    `<div class="validation-item">
      <span class="v-icon">${c.passed ? '✓' : c.critical ? '✗' : '⚠'}</span>
      <span class="v-name">${c.name}</span>
      <span class="v-detail">${c.detail}</span>
    </div>`
  ).join('');
  chat.appendChild(list);
  scrollToBottom();
}

function renderSummary(summary) {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  const card = document.createElement('div');
  card.className = 'summary-card';
  card.innerHTML = `
    <h3>Installation Complete</h3>
    <div class="summary-row"><span class="s-label">PAI Version</span><span class="s-value">v${summary.paiVersion}</span></div>
    <div class="summary-row"><span class="s-label">Principal</span><span class="s-value">${summary.principalName}</span></div>
    <div class="summary-row"><span class="s-label">AI Name</span><span class="s-value">${summary.aiName}</span></div>
    <div class="summary-row"><span class="s-label">Timezone</span><span class="s-value">${summary.timezone}</span></div>
    <div class="summary-row"><span class="s-label">Voice</span><span class="s-value">${summary.voiceEnabled ? summary.voiceMode : 'Disabled'}</span></div>
    <div class="summary-row"><span class="s-label">Install Type</span><span class="s-value">${summary.installType}</span></div>
    <div class="summary-action">
      <p>To activate PAI, open a terminal and run:</p>
      <code>source ~/.zshrc && pai</code>
      <p class="summary-hint">This reloads your shell config and launches PAI for the first time.</p>
    </div>
  `;
  chat.appendChild(card);
  scrollToBottom();
}

// ─── Welcome Screen ──────────────────────────────────────────────

function startInstall() {
  const overlay = document.getElementById('welcome-overlay');
  if (overlay) overlay.classList.add('hidden');

  // Start installation
  ws.send(JSON.stringify({ type: 'start_install' }));
}

// ─── Utilities ───────────────────────────────────────────────────

function scrollToBottom() {
  const chat = document.getElementById('chat-messages');
  if (chat) {
    // Double-RAF ensures DOM has fully rendered before scrolling
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chat.scrollTop = chat.scrollHeight;
      });
    });
  }
}

// ─── Initialize ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderSteps();
  connect();

  // Welcome audio is played via <audio autoplay> in index.html
});
