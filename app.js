(function () {
  'use strict';

  const CONFIG = window.AMIGO_OCULTO_CONFIG || {};
  const SCRIPT_URL = (CONFIG.SCRIPT_URL || '').trim();
  const PARAMS = new URLSearchParams(window.location.search);
  const IS_DEMO = PARAMS.get('demo') === '1' || !SCRIPT_URL;

  // Chaves de trava por aparelho (NUNCA salvam o nome sorteado — apenas status do aparelho)
  const STORAGE_DEVICE_ID = 'natal_friends_2026_device_id';
  const STORAGE_LOCK_PROD = 'natal_friends_2026_device_lock';
  const STORAGE_LOCK_DEMO = 'natal_friends_2026_demo_lock';
  const COOKIE_DEVICE_ID = 'nf26_did';
  const COOKIE_LOCK_PROD = 'nf26_lock';
  const COOKIE_LOCK_DEMO = 'nf26_dlock';

  // Lista e casais usados APENAS no Modo Demonstração local (quando SCRIPT_URL ainda está vazia)
  const DEMO_PARTICIPANTS = [
    'Camila Nascimento',
    'Tiago',
    'Simone',
    'Tony',
    'Camila Nely',
    'Nayara Nely',
    'Lucas Nely',
    'Gessica Santos',
    'Julia',
    'Vinicius',
    'Denise',
    'Maria Licia (Tia ciça)',
    'Maílson',
    'Tamires',
    'Laura Sophia',
    'Maria Aparecida (Dona Cida)',
  ];

  const DEMO_COUPLES = [
    ['Tony', 'Simone'],
    ['Nayara Nely', 'Lucas Nely'],
    ['Julia', 'Vinicius'],
    ['Camila Nascimento', 'Tiago'],
    ['Maílson', 'Tamires'],
  ];

  const state = {
    participants: [],
    selectedParticipant: '',
    isDrawing: false,
    cycleId: '',
    demoCycleId: 'demo-cycle-1',
    demoMap: null,
    demoDrawn: {},
    demoUsedDevices: {},
  };

  // Elementos da UI
  const els = {
    demoBanner: document.getElementById('demo-banner'),
    demoResetBtn: document.getElementById('demo-reset-btn'),
    eventTitle: document.getElementById('event-title'),
    eventSubtitle: document.getElementById('event-subtitle'),
    giftValue: document.getElementById('gift-value'),
    giftValueDone: document.getElementById('gift-value-done'),
    giftValueReveal: document.getElementById('gift-value-reveal'),
    giftValueLocked: document.getElementById('gift-value-locked'),
    progressLabel: document.getElementById('progress-label'),
    progressPercent: document.getElementById('progress-percent'),
    progressFill: document.getElementById('progress-fill'),
    progressBar: document.querySelector('.progress-bar'),
    alertBox: document.getElementById('alert-box'),
    stepSelect: document.getElementById('step-select'),
    stepLoading: document.getElementById('step-loading'),
    stepReveal: document.getElementById('step-reveal'),
    stepFinished: document.getElementById('step-finished'),
    select: document.getElementById('participant-select'),
    startDrawBtn: document.getElementById('start-draw-btn'),
    allDoneBox: document.getElementById('all-done-box'),
    allDoneTotal: document.getElementById('all-done-total'),
    statusDetails: document.getElementById('status-details'),
    statusList: document.getElementById('status-list'),
    lockedStatusDetails: document.getElementById('locked-status-details'),
    lockedStatusList: document.getElementById('locked-status-list'),
    finishedParticipantNote: document.getElementById('finished-participant-note'),
    refreshStatusBtn: document.getElementById('refresh-status-btn'),
    revealGiver: document.getElementById('reveal-giver'),
    revealName: document.getElementById('reveal-name'),
    ackCheckbox: document.getElementById('ack-saved-checkbox'),
    hideResultBtn: document.getElementById('hide-result-btn'),
    confirmModal: document.getElementById('confirm-modal'),
    confirmName: document.getElementById('confirm-name'),
    confirmCancelBtn: document.getElementById('confirm-cancel-btn'),
    confirmProceedBtn: document.getElementById('confirm-proceed-btn'),
    confettiCanvas: document.getElementById('confetti-canvas'),
  };

  // ============================================================================
  // BLOQUEIO POR APARELHO (localStorage + Cookie + deviceId no servidor)
  // ============================================================================

  function setCookie(name, value, days) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie =
        name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (_e) {
      // ignora se cookies estiverem bloqueados
    }
  }

  function getCookie(name) {
    try {
      const prefix = name + '=';
      const parts = document.cookie.split(';');
      for (let i = 0; i < parts.length; i++) {
        const item = parts[i].trim();
        if (item.indexOf(prefix) === 0) {
          return decodeURIComponent(item.slice(prefix.length));
        }
      }
    } catch (_e) {
      // ignora
    }
    return '';
  }

  function deleteCookie(name) {
    try {
      document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
    } catch (_e) {
      // ignora
    }
  }

  function generateUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function getOrCreateDeviceId() {
    let id = '';
    try {
      id = window.localStorage.getItem(STORAGE_DEVICE_ID) || '';
    } catch (_e) {
      // ignora
    }
    if (!id) {
      id = getCookie(COOKIE_DEVICE_ID);
    }
    if (!id) {
      id = generateUuid();
    }
    try {
      window.localStorage.setItem(STORAGE_DEVICE_ID, id);
    } catch (_e) {
      // ignora
    }
    setCookie(COOKIE_DEVICE_ID, id, 365);
    return id;
  }

  function getLockKeys() {
    return IS_DEMO
      ? { storage: STORAGE_LOCK_DEMO, cookie: COOKIE_LOCK_DEMO }
      : { storage: STORAGE_LOCK_PROD, cookie: COOKIE_LOCK_PROD };
  }

  function readLocalLock() {
    const keys = getLockKeys();
    let raw = '';
    try {
      raw = window.localStorage.getItem(keys.storage) || '';
    } catch (_e) {
      // ignora
    }
    if (!raw) {
      raw = getCookie(keys.cookie);
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.locked) return parsed;
    } catch (_e) {
      // ignora
    }
    return null;
  }

  function saveLocalLock(participant, cycleId) {
    const keys = getLockKeys();
    // Salva APENAS status de bloqueio e quem usou o aparelho — NUNCA quem foi sorteado
    const payload = JSON.stringify({
      locked: true,
      participant: participant || '',
      cycleId: cycleId || '',
    });
    try {
      window.localStorage.setItem(keys.storage, payload);
    } catch (_e) {
      // ignora
    }
    setCookie(keys.cookie, payload, 365);
  }

  function clearLocalLock() {
    const keys = getLockKeys();
    try {
      window.localStorage.removeItem(keys.storage);
    } catch (_e) {
      // ignora
    }
    deleteCookie(keys.cookie);
  }

  const DEVICE_ID = getOrCreateDeviceId();

  // ============================================================================
  // MODO DEMONSTRAÇÃO (SOMENTE EM MEMÓRIA — SEM GRAVAR QUEM FOI SORTEADO)
  // ============================================================================

  function isDemoCouple(a, b) {
    return DEMO_COUPLES.some(function (pair) {
      return (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a);
    });
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function initDemoState() {
    state.demoDrawn = {};
    state.demoUsedDevices = {};
    state.demoCycleId = 'demo-' + Date.now();
    for (let attempt = 0; attempt < 2000; attempt++) {
      const shuffled = shuffle(DEMO_PARTICIPANTS);
      let ok = true;
      for (let i = 0; i < DEMO_PARTICIPANTS.length; i++) {
        const giver = DEMO_PARTICIPANTS[i];
        const receiver = shuffled[i];
        if (giver === receiver || isDemoCouple(giver, receiver)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        const map = {};
        DEMO_PARTICIPANTS.forEach(function (giver, idx) {
          map[giver] = shuffled[idx];
        });
        state.demoMap = map;
        return;
      }
    }
  }

  async function apiListParticipants() {
    if (IS_DEMO) {
      if (!state.demoMap) initDemoState();
      const participants = DEMO_PARTICIPANTS.map(function (name) {
        return { name: name, drawn: Boolean(state.demoDrawn[name]) };
      });
      const completed = participants.filter(function (p) {
        return p.drawn;
      }).length;
      const lockedParticipant = state.demoUsedDevices[DEVICE_ID] || null;
      return {
        ok: true,
        cycleId: state.demoCycleId,
        deviceLocked: Boolean(lockedParticipant),
        lockedParticipant: lockedParticipant,
        total: DEMO_PARTICIPANTS.length,
        completed: completed,
        participants: participants,
      };
    }

    const sep = SCRIPT_URL.includes('?') ? '&' : '?';
    const url =
      SCRIPT_URL +
      sep +
      'action=list&deviceId=' +
      encodeURIComponent(DEVICE_ID) +
      '&_t=' +
      Date.now();
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Falha ao conectar com o servidor do sorteio.');
    }
    return res.json();
  }

  async function apiDrawParticipant(participant) {
    if (IS_DEMO) {
      await delay(950);
      if (state.demoUsedDevices[DEVICE_ID]) {
        return {
          ok: false,
          code: 'DEVICE_ALREADY_USED',
          cycleId: state.demoCycleId,
          lockedParticipant: state.demoUsedDevices[DEVICE_ID],
          message: 'Este aparelho já realizou um sorteio anteriormente.',
        };
      }
      if (state.demoDrawn[participant] || !state.demoMap[participant]) {
        return {
          ok: false,
          code: 'ALREADY_DRAWN',
          message: 'Este participante já realizou o sorteio anteriormente.',
        };
      }
      const drawnName = state.demoMap[participant];
      delete state.demoMap[participant];
      state.demoDrawn[participant] = true;
      state.demoUsedDevices[DEVICE_ID] = participant;
      return {
        ok: true,
        cycleId: state.demoCycleId,
        participant: participant,
        drawnName: drawnName,
        completed: Object.keys(state.demoDrawn).length,
        total: DEMO_PARTICIPANTS.length,
      };
    }

    // Content-Type text/plain evita preflight CORS (OPTIONS) no Google Apps Script
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'draw',
        participant: participant,
        deviceId: DEVICE_ID,
      }),
    });

    if (!res.ok) {
      throw new Error('Não foi possível conectar ao servidor do sorteio.');
    }
    return res.json();
  }

  // ============================================================================
  // CONTROLE DE INTERFACE
  // ============================================================================

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function showAlert(message) {
    if (!message) {
      els.alertBox.textContent = '';
      els.alertBox.classList.add('hidden');
      return;
    }
    els.alertBox.textContent = message;
    els.alertBox.classList.remove('hidden');
  }

  function showStep(stepEl) {
    [els.stepSelect, els.stepLoading, els.stepReveal, els.stepFinished].forEach(function (el) {
      el.classList.toggle('hidden', el !== stepEl);
    });
  }

  function updateProgress(completed, total) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    els.progressLabel.textContent = completed + ' de ' + total + ' já sortearam';
    els.progressPercent.textContent = pct + '%';
    els.progressFill.style.width = pct + '%';
    els.progressBar.setAttribute('aria-valuenow', String(pct));
    if (els.allDoneTotal) {
      els.allDoneTotal.textContent = String(total);
    }
  }

  function renderStatusList(targetUl, targetDetails) {
    targetUl.innerHTML = '';
    state.participants.forEach(function (p) {
      const li = document.createElement('li');
      li.className = 'status-list__item' + (p.drawn ? ' status-list__item--done' : '');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'status-list__name';
      nameSpan.textContent = p.name;

      const iconSpan = document.createElement('span');
      iconSpan.textContent = p.drawn ? '✅' : '⏳';
      iconSpan.setAttribute('aria-label', p.drawn ? 'Já sorteou' : 'Pendente');

      li.appendChild(nameSpan);
      li.appendChild(iconSpan);
      targetUl.appendChild(li);
    });
    targetDetails.classList.toggle('hidden', state.participants.length === 0);
  }

  function showLockedScreen(participantName) {
    if (participantName) {
      els.finishedParticipantNote.textContent = 'Participação registrada: ' + participantName;
      els.finishedParticipantNote.classList.remove('hidden');
    } else {
      els.finishedParticipantNote.textContent = '';
      els.finishedParticipantNote.classList.add('hidden');
    }
    renderStatusList(els.lockedStatusList, els.lockedStatusDetails);
    showStep(els.stepFinished);
  }

  function renderParticipants(data) {
    state.participants = data.participants || [];
    state.cycleId = data.cycleId || '';
    const total = data.total || state.participants.length;
    const completed = data.completed || 0;

    updateProgress(completed, total);

    // Verifica trava por aparelho (tanto no servidor quanto local)
    const localLock = readLocalLock();

    // Se o organizador resetou o sorteio (novo cycleId no servidor), destrava ciclos antigos automaticamente
    if (!IS_DEMO && localLock && state.cycleId && localLock.cycleId !== state.cycleId) {
      clearLocalLock();
    }

    const activeLocalLock = readLocalLock();
    if (data.deviceLocked || activeLocalLock) {
      const lockedWho = data.lockedParticipant || (activeLocalLock && activeLocalLock.participant) || '';
      if (!activeLocalLock && data.deviceLocked) {
        saveLocalLock(lockedWho, state.cycleId);
      }
      showLockedScreen(lockedWho);
      return;
    }

    const pendingCount = state.participants.filter(function (p) {
      return !p.drawn;
    }).length;

    els.select.innerHTML = '';

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent =
      pendingCount > 0 ? '— Selecione seu nome na lista —' : 'Todos os participantes já sortearam';
    els.select.appendChild(defaultOpt);

    state.participants.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.name;
      if (p.drawn) {
        opt.textContent = p.name + '  —  ✅ Já sorteou';
        opt.disabled = true;
      } else {
        opt.textContent = p.name;
      }
      els.select.appendChild(opt);
    });

    els.select.disabled = pendingCount === 0;
    els.startDrawBtn.disabled = true;
    els.allDoneBox.classList.toggle('hidden', pendingCount > 0);

    renderStatusList(els.statusList, els.statusDetails);
    showStep(els.stepSelect);
  }

  async function loadParticipants() {
    showAlert('');
    els.select.disabled = true;
    els.startDrawBtn.disabled = true;

    // Se já houver bloqueio local, impede imediatamente interação enquanto sincroniza progresso
    const preLock = readLocalLock();
    if (preLock && IS_DEMO) {
      // Em modo demo, recarrega estado mantendo o bloqueio local se existir
      if (!state.demoMap) initDemoState();
      if (preLock.participant) {
        state.demoDrawn[preLock.participant] = true;
        state.demoUsedDevices[DEVICE_ID] = preLock.participant;
      }
    }

    try {
      const data = await apiListParticipants();
      if (!data || !data.ok) {
        throw new Error((data && data.message) || 'Erro ao carregar a lista.');
      }
      renderParticipants(data);
    } catch (err) {
      if (preLock) {
        showLockedScreen(preLock.participant || '');
        return;
      }
      els.progressLabel.textContent = 'Não foi possível carregar';
      els.progressPercent.textContent = '!';
      showAlert(
        (err && err.message) ||
          'Erro de conexão ao buscar os participantes. Verifique sua internet e recarregue a página.'
      );
    }
  }

  function openConfirmModal(name) {
    state.selectedParticipant = name;
    els.confirmName.textContent = name;
    els.confirmModal.classList.remove('hidden');
    els.confirmProceedBtn.focus();
  }

  function closeConfirmModal() {
    els.confirmModal.classList.add('hidden');
  }

  async function executeDraw() {
    if (state.isDrawing || !state.selectedParticipant) return;
    state.isDrawing = true;
    const participant = state.selectedParticipant;

    closeConfirmModal();
    showAlert('');
    showStep(els.stepLoading);

    const minAnimDelay = delay(900);

    try {
      const [result] = await Promise.all([apiDrawParticipant(participant), minAnimDelay]);

      if (!result || !result.ok) {
        if (result && result.code === 'DEVICE_ALREADY_USED') {
          const lockedWho = result.lockedParticipant || '';
          saveLocalLock(lockedWho, result.cycleId || state.cycleId);
          showLockedScreen(lockedWho);
          return;
        }

        showStep(els.stepSelect);
        showAlert(
          (result && result.message) ||
            'Não foi possível realizar o sorteio. Atualizando a lista...'
        );
        await loadParticipants();
        return;
      }

      // Trava imediatamente este aparelho (sem salvar quem foi sorteado!)
      saveLocalLock(participant, result.cycleId || state.cycleId);
      updateProgress(result.completed, result.total);

      // Atualiza estado local da lista para o resumo pós-sorteio
      state.participants = state.participants.map(function (p) {
        return p.name === participant ? { name: p.name, drawn: true } : p;
      });

      // Revelação única
      els.revealGiver.textContent = participant;
      els.revealName.textContent = result.drawnName;
      els.ackCheckbox.checked = false;
      els.hideResultBtn.disabled = true;

      showStep(els.stepReveal);
      launchConfetti();
    } catch (err) {
      showStep(els.stepSelect);
      showAlert(
        (err && err.message) || 'Erro de conexão durante o sorteio. Tente novamente em instantes.'
      );
      await loadParticipants();
    } finally {
      state.isDrawing = false;
    }
  }

  function hideRevealSafely() {
    const participantName = state.selectedParticipant || (readLocalLock() && readLocalLock().participant) || '';

    // Limpa imediatamente o nome sorteado da árvore DOM
    els.revealName.textContent = '—';
    els.revealGiver.textContent = '';
    els.ackCheckbox.checked = false;
    els.hideResultBtn.disabled = true;
    state.selectedParticipant = '';

    showLockedScreen(participantName);
  }

  // ============================================================================
  // CONFETES FESTIVOS
  // ============================================================================

  function launchConfetti() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const canvas = els.confettiCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#D4AF37', '#A9252D', '#1B4332', '#FFFDF8', '#F6E27A'];
    const pieces = [];
    for (let i = 0; i < 90; i++) {
      pieces.push({
        x: canvas.width * (0.2 + Math.random() * 0.6),
        y: canvas.height * 0.32,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 10 - 3,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.2,
        alpha: 1,
      });
    }

    let frame = 0;
    function tick() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = 0;
      pieces.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24;
        p.vx *= 0.99;
        p.rot += p.vrot;
        if (frame > 85) p.alpha -= 0.02;

        if (p.alpha > 0 && p.y < canvas.height + 20) {
          alive++;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive > 0 && frame < 160) {
        requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    requestAnimationFrame(tick);
  }

  // ============================================================================
  // INICIALIZAÇÃO E EVENTOS
  // ============================================================================

  function applyConfigTexts() {
    if (CONFIG.EVENT_TITLE) els.eventTitle.textContent = CONFIG.EVENT_TITLE;
    if (CONFIG.EVENT_SUBTITLE) els.eventSubtitle.textContent = CONFIG.EVENT_SUBTITLE;
    if (CONFIG.GIFT_VALUE) {
      els.giftValue.textContent = CONFIG.GIFT_VALUE;
      els.giftValueDone.textContent = CONFIG.GIFT_VALUE;
      els.giftValueReveal.textContent = CONFIG.GIFT_VALUE;
      if (els.giftValueLocked) els.giftValueLocked.textContent = CONFIG.GIFT_VALUE;
    }
    if (IS_DEMO) {
      els.demoBanner.classList.remove('hidden');
    }
  }

  function bindEvents() {
    els.select.addEventListener('change', function () {
      showAlert('');
      els.startDrawBtn.disabled = !els.select.value;
    });

    els.startDrawBtn.addEventListener('click', function () {
      const selected = els.select.value;
      if (!selected) return;
      openConfirmModal(selected);
    });

    els.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    els.confirmModal.addEventListener('click', function (ev) {
      if (ev.target && ev.target.dataset && ev.target.dataset.closeModal === 'true') {
        closeConfirmModal();
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !els.confirmModal.classList.contains('hidden')) {
        closeConfirmModal();
      }
    });

    els.confirmProceedBtn.addEventListener('click', executeDraw);

    els.ackCheckbox.addEventListener('change', function () {
      els.hideResultBtn.disabled = !els.ackCheckbox.checked;
    });

    els.hideResultBtn.addEventListener('click', hideRevealSafely);

    if (els.refreshStatusBtn) {
      els.refreshStatusBtn.addEventListener('click', async function () {
        els.refreshStatusBtn.disabled = true;
        try {
          await loadParticipants();
        } finally {
          els.refreshStatusBtn.disabled = false;
        }
      });
    }

    els.demoResetBtn.addEventListener('click', async function () {
      clearLocalLock();
      initDemoState();
      showStep(els.stepSelect);
      await loadParticipants();
    });
  }

  applyConfigTexts();
  bindEvents();
  loadParticipants();
})();
