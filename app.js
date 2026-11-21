(function () {
  'use strict';

  const CONFIG = window.AMIGO_OCULTO_CONFIG || {};
  const SCRIPT_URL = (CONFIG.SCRIPT_URL || '').trim();
  const PARAMS = new URLSearchParams(window.location.search);
  const IS_DEMO = PARAMS.get('demo') === '1' || !SCRIPT_URL;
  const MAX_WISHES = 5;

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
    activeTab: 'draw',
    participants: [],
    selectedParticipant: '',
    lockedParticipant: '',
    isDrawing: false,
    cycleId: '',

    // Estado da Lista de Presentes
    wishesLoaded: false,
    wishlist: [],
    wishesViewMode: 'carousel', // 'carousel' | 'list'
    wishesSearch: '',
    carouselIndex: 0,
    carouselTimer: null,
    carouselPaused: false,
    isSavingWishes: false,

    // Estado do Modo Demonstração
    demoCycleId: 'demo-cycle-1',
    demoMap: null,
    demoDrawn: {},
    demoUsedDevices: {},
    demoWishes: {
      'Camila Nascimento': {
        wishes: ['Caneca natalina', 'Livro de romance', 'Chocolates artesanais'],
        updatedAt: '21/11/2026 12:30:00',
      },
      'Gessica Santos': {
        wishes: ['Vela aromática de baunilha', 'Kit skincare básico'],
        updatedAt: '21/11/2026 12:35:00',
      },
    },
  };

  // Elementos da UI
  const els = {
    toast: document.getElementById('toast'),
    demoBanner: document.getElementById('demo-banner'),
    demoResetBtn: document.getElementById('demo-reset-btn'),
    eventTitle: document.getElementById('event-title'),
    eventSubtitle: document.getElementById('event-subtitle'),
    giftValue: document.getElementById('gift-value'),
    giftValueDone: document.getElementById('gift-value-done'),
    giftValueReveal: document.getElementById('gift-value-reveal'),
    giftValueLocked: document.getElementById('gift-value-locked'),
    giftValueWishes: document.getElementById('gift-value-wishes'),

    // Abas
    mainTabs: document.getElementById('main-tabs'),
    tabDraw: document.getElementById('tab-draw'),
    tabWishes: document.getElementById('tab-wishes'),
    wishesTabBadge: document.getElementById('wishes-tab-badge'),
    viewDraw: document.getElementById('view-draw'),
    viewWishes: document.getElementById('view-wishes'),

    // Sorteio
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
    goWishesFromLockedBtn: document.getElementById('go-wishes-from-locked-btn'),
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

    // Lista de Presentes
    wishesSummary: document.getElementById('wishes-summary'),
    openWishesModalBtn: document.getElementById('open-wishes-modal-btn'),
    wishesAlert: document.getElementById('wishes-alert'),
    wishesControls: document.getElementById('wishes-controls'),
    modeCarouselBtn: document.getElementById('mode-carousel-btn'),
    modeListBtn: document.getElementById('mode-list-btn'),
    wishesLoading: document.getElementById('wishes-loading'),
    wishesEmpty: document.getElementById('wishes-empty'),
    wishesCarouselView: document.getElementById('wishes-carousel-view'),
    carouselTrack: document.getElementById('carousel-track'),
    carouselPrevBtn: document.getElementById('carousel-prev-btn'),
    carouselNextBtn: document.getElementById('carousel-next-btn'),
    carouselDots: document.getElementById('carousel-dots'),
    carouselCounter: document.getElementById('carousel-counter'),
    wishesListView: document.getElementById('wishes-list-view'),
    wishesSearchInput: document.getElementById('wishes-search-input'),
    wishesCardsList: document.getElementById('wishes-cards-list'),

    // Modal de Cadastro de Presentes
    wishesModal: document.getElementById('wishes-modal'),
    wishesModalCloseBtn: document.getElementById('wishes-modal-close-btn'),
    wishesForm: document.getElementById('wishes-form'),
    wishesParticipantSelect: document.getElementById('wishes-participant-select'),
    wishesExistingNotice: document.getElementById('wishes-existing-notice'),
    wishesConfirmWrap: document.getElementById('wishes-confirm-overwrite-wrap'),
    wishesConfirmCheckbox: document.getElementById('wishes-confirm-overwrite'),
    wishesConfirmName: document.getElementById('wishes-confirm-name'),
    wishesFormError: document.getElementById('wishes-form-error'),
    wishesCancelBtn: document.getElementById('wishes-cancel-btn'),
    wishesSaveBtn: document.getElementById('wishes-save-btn'),
    wishInputs: [
      document.getElementById('wish-1'),
      document.getElementById('wish-2'),
      document.getElementById('wish-3'),
      document.getElementById('wish-4'),
      document.getElementById('wish-5'),
    ],
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
  // MODO DEMONSTRAÇÃO & API
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

  function buildDemoWishlistPayload() {
    const wishlist = DEMO_PARTICIPANTS.map(function (name) {
      const entry = state.demoWishes[name] || { wishes: [], updatedAt: '' };
      return {
        name: name,
        wishes: entry.wishes.slice(),
        updatedAt: entry.updatedAt,
      };
    });
    const filledCount = wishlist.filter(function (w) {
      return w.wishes.length > 0;
    }).length;
    return {
      ok: true,
      maxWishes: MAX_WISHES,
      total: DEMO_PARTICIPANTS.length,
      filledCount: filledCount,
      wishlist: wishlist,
    };
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

  async function apiGetWishes() {
    if (IS_DEMO) {
      return buildDemoWishlistPayload();
    }

    const sep = SCRIPT_URL.includes('?') ? '&' : '?';
    const url = SCRIPT_URL + sep + 'action=wishes&_t=' + Date.now();
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error('Falha ao carregar a Lista de Presentes.');
    }
    return res.json();
  }

  async function apiSaveWishes(participant, wishes) {
    if (IS_DEMO) {
      await delay(450);
      const now = new Date();
      const pad = function (n) {
        return String(n).padStart(2, '0');
      };
      const ts =
        pad(now.getDate()) +
        '/' +
        pad(now.getMonth() + 1) +
        '/' +
        now.getFullYear() +
        ' ' +
        pad(now.getHours()) +
        ':' +
        pad(now.getMinutes()) +
        ':' +
        pad(now.getSeconds());
      state.demoWishes[participant] = { wishes: wishes.slice(), updatedAt: ts };
      const payload = buildDemoWishlistPayload();
      payload.participant = participant;
      payload.wishes = wishes.slice();
      payload.updatedAt = ts;
      return payload;
    }

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'save_wishes',
        participant: participant,
        wishes: wishes,
      }),
    });

    if (!res.ok) {
      throw new Error('Não foi possível salvar sua Lista de Presentes.');
    }
    return res.json();
  }

  // ============================================================================
  // UTILITÁRIOS DE INTERFACE E ABAS
  // ============================================================================

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  let toastTimer = null;
  function showToast(message) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.add('hidden');
    }, 3400);
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

  function showWishesAlert(message) {
    if (!message) {
      els.wishesAlert.textContent = '';
      els.wishesAlert.classList.add('hidden');
      return;
    }
    els.wishesAlert.textContent = message;
    els.wishesAlert.classList.remove('hidden');
  }

  function showWishesFormError(message) {
    if (!message) {
      els.wishesFormError.textContent = '';
      els.wishesFormError.classList.add('hidden');
      return;
    }
    els.wishesFormError.textContent = message;
    els.wishesFormError.classList.remove('hidden');
  }

  function switchTab(tabName) {
    state.activeTab = tabName;
    const isDraw = tabName === 'draw';

    els.tabDraw.classList.toggle('nav-tabs__btn--active', isDraw);
    els.tabDraw.setAttribute('aria-selected', String(isDraw));

    els.tabWishes.classList.toggle('nav-tabs__btn--active', !isDraw);
    els.tabWishes.setAttribute('aria-selected', String(!isDraw));

    els.viewDraw.classList.toggle('hidden', !isDraw);
    els.viewWishes.classList.toggle('hidden', isDraw);

    if (!isDraw) {
      if (!state.wishesLoaded) {
        loadWishes();
      } else {
        startCarouselAutoplay();
      }
    } else {
      stopCarouselAutoplay();
    }
  }

  function showStep(stepEl) {
    [els.stepSelect, els.stepLoading, els.stepReveal, els.stepFinished].forEach(function (el) {
      el.classList.toggle('hidden', el !== stepEl);
    });
    // Esconde as abas durante a tela de revelação única para não distrair antes do print
    const hideTabs = stepEl === els.stepReveal || stepEl === els.stepLoading;
    els.mainTabs.classList.toggle('hidden', hideTabs);
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
    state.lockedParticipant = participantName || state.lockedParticipant || '';
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
    populateWishesParticipantSelect();

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

    const preLock = readLocalLock();
    if (preLock && IS_DEMO) {
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

  // ============================================================================
  // SORTEIO
  // ============================================================================

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

      saveLocalLock(participant, result.cycleId || state.cycleId);
      state.lockedParticipant = participant;
      updateProgress(result.completed, result.total);

      state.participants = state.participants.map(function (p) {
        return p.name === participant ? { name: p.name, drawn: true } : p;
      });

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
    const participantName =
      state.selectedParticipant || (readLocalLock() && readLocalLock().participant) || '';

    els.revealName.textContent = '—';
    els.revealGiver.textContent = '';
    els.ackCheckbox.checked = false;
    els.hideResultBtn.disabled = true;
    state.selectedParticipant = '';

    showLockedScreen(participantName);
  }

  // ============================================================================
  // LISTA DE PRESENTES — CARROSSEL SUAVE, LISTA COMPLETA E CADASTRO
  // ============================================================================

  function getInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function buildWishCardElement(entry, isListMode) {
    const hasWishes = entry.wishes && entry.wishes.length > 0;
    const card = document.createElement('article');
    card.className =
      'wish-card' +
      (isListMode ? ' wish-card--list' : '') +
      (!hasWishes ? ' wish-card--pending' : '');

    const head = document.createElement('div');
    head.className = 'wish-card__head';

    const person = document.createElement('div');
    person.className = 'wish-card__person';

    const avatar = document.createElement('div');
    avatar.className = 'wish-card__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = getInitials(entry.name);

    const title = document.createElement('h3');
    title.className = 'wish-card__name';
    title.textContent = entry.name;

    person.appendChild(avatar);
    person.appendChild(title);

    const countBadge = document.createElement('span');
    countBadge.className = 'wish-card__count';
    countBadge.textContent = hasWishes
      ? entry.wishes.length + (entry.wishes.length === 1 ? ' ideia' : ' ideias')
      : 'Pendente';

    head.appendChild(person);
    head.appendChild(countBadge);
    card.appendChild(head);

    if (hasWishes) {
      const ul = document.createElement('ul');
      ul.className = 'wish-card__items';

      entry.wishes.forEach(function (wishText, idx) {
        const li = document.createElement('li');
        li.className = 'wish-card__item';

        const num = document.createElement('span');
        num.className = 'wish-card__num';
        num.textContent = String(idx + 1);

        const text = document.createElement('span');
        text.textContent = wishText;

        li.appendChild(num);
        li.appendChild(text);
        ul.appendChild(li);
      });

      card.appendChild(ul);
    } else {
      const p = document.createElement('p');
      p.className = 'wish-card__pending-msg';
      p.textContent = 'Ainda não cadastrou sugestões de presentes.';
      card.appendChild(p);
    }

    return card;
  }

  function getFilledWishes() {
    return state.wishlist.filter(function (item) {
      return item.wishes && item.wishes.length > 0;
    });
  }

  function updateCarouselUI() {
    const filled = getFilledWishes();
    const total = filled.length;
    if (total === 0) return;

    if (state.carouselIndex >= total) state.carouselIndex = 0;
    if (state.carouselIndex < 0) state.carouselIndex = total - 1;

    els.carouselCounter.textContent = state.carouselIndex + 1 + ' / ' + total;

    const dots = els.carouselDots.querySelectorAll('.carousel__dot');
    dots.forEach(function (dot, idx) {
      const active = idx === state.carouselIndex;
      dot.classList.toggle('carousel__dot--active', active);
      dot.setAttribute('aria-selected', String(active));
    });
  }

  function goToSlide(index, instant) {
    const filled = getFilledWishes();
    if (filled.length === 0) return;

    const wrapped = ((index % filled.length) + filled.length) % filled.length;
    state.carouselIndex = wrapped;

    const targetCard = els.carouselTrack.children[wrapped];
    if (targetCard) {
      els.carouselTrack.scrollTo({
        left: targetCard.offsetLeft - els.carouselTrack.offsetLeft,
        behavior: instant ? 'auto' : 'smooth',
      });
    }
    updateCarouselUI();
  }

  function stopCarouselAutoplay() {
    if (state.carouselTimer) {
      clearInterval(state.carouselTimer);
      state.carouselTimer = null;
    }
  }

  function startCarouselAutoplay() {
    stopCarouselAutoplay();
    const prefersReduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      prefersReduced ||
      state.activeTab !== 'wishes' ||
      state.wishesViewMode !== 'carousel' ||
      state.carouselPaused ||
      getFilledWishes().length <= 1
    ) {
      return;
    }
    state.carouselTimer = setInterval(function () {
      if (!state.carouselPaused && state.activeTab === 'wishes' && state.wishesViewMode === 'carousel') {
        goToSlide(state.carouselIndex + 1, false);
      }
    }, 5200);
  }

  function renderWishesCarousel() {
    const filled = getFilledWishes();
    els.carouselTrack.innerHTML = '';
    els.carouselDots.innerHTML = '';

    filled.forEach(function (entry, idx) {
      els.carouselTrack.appendChild(buildWishCardElement(entry, false));

      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel__dot' + (idx === state.carouselIndex ? ' carousel__dot--active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Ver presentes de ' + entry.name);
      dot.addEventListener('click', function () {
        goToSlide(idx, false);
        startCarouselAutoplay();
      });
      els.carouselDots.appendChild(dot);
    });

    const single = filled.length <= 1;
    els.carouselPrevBtn.disabled = single;
    els.carouselNextBtn.disabled = single;

    goToSlide(Math.min(state.carouselIndex, Math.max(0, filled.length - 1)), true);
    startCarouselAutoplay();
  }

  function renderWishesList() {
    const query = state.wishesSearch.trim().toLowerCase();
    const filtered = state.wishlist.filter(function (entry) {
      if (!query) return true;
      const inName = entry.name.toLowerCase().includes(query);
      const inWishes = (entry.wishes || []).some(function (w) {
        return w.toLowerCase().includes(query);
      });
      return inName || inWishes;
    });

    // Mostra primeiro quem já cadastrou presentes, depois quem ainda está pendente
    const sorted = filtered.slice().sort(function (a, b) {
      const aFilled = a.wishes.length > 0 ? 1 : 0;
      const bFilled = b.wishes.length > 0 ? 1 : 0;
      return bFilled - aFilled;
    });

    els.wishesCardsList.innerHTML = '';

    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'wishes-empty__text';
      empty.style.textAlign = 'center';
      empty.style.padding = '16px 0';
      empty.textContent = 'Nenhum participante encontrado para "' + state.wishesSearch.trim() + '".';
      els.wishesCardsList.appendChild(empty);
      return;
    }

    sorted.forEach(function (entry) {
      els.wishesCardsList.appendChild(buildWishCardElement(entry, true));
    });
  }

  function setWishesViewMode(mode) {
    state.wishesViewMode = mode;
    const isCarousel = mode === 'carousel';

    els.modeCarouselBtn.classList.toggle('view-toggle__btn--active', isCarousel);
    els.modeListBtn.classList.toggle('view-toggle__btn--active', !isCarousel);

    const hasFilled = getFilledWishes().length > 0;
    els.wishesCarouselView.classList.toggle('hidden', !isCarousel || !hasFilled);
    els.wishesListView.classList.toggle('hidden', isCarousel || state.wishlist.length === 0);

    if (isCarousel && hasFilled) {
      renderWishesCarousel();
    } else {
      stopCarouselAutoplay();
      renderWishesList();
    }
  }

  function renderWishes(data, focusParticipant) {
    state.wishesLoaded = true;
    state.wishlist = data.wishlist || [];
    const total = data.total || state.wishlist.length;
    const filled = getFilledWishes();
    const filledCount = filled.length;

    els.wishesLoading.classList.add('hidden');
    els.wishesSummary.textContent =
      filledCount + ' de ' + total + ' já cadastraram sugestões de presentes';

    els.wishesTabBadge.textContent = String(filledCount);
    els.wishesTabBadge.classList.remove('hidden');

    populateWishesParticipantSelect();

    if (filledCount === 0) {
      els.wishesEmpty.classList.remove('hidden');
      els.wishesControls.classList.add('hidden');
      els.wishesCarouselView.classList.add('hidden');
      els.wishesListView.classList.add('hidden');
      stopCarouselAutoplay();
      return;
    }

    els.wishesEmpty.classList.add('hidden');
    els.wishesControls.classList.remove('hidden');

    if (focusParticipant) {
      const targetIdx = filled.findIndex(function (item) {
        return item.name === focusParticipant;
      });
      if (targetIdx !== -1) {
        state.carouselIndex = targetIdx;
      }
    }

    setWishesViewMode(state.wishesViewMode);
  }

  async function loadWishes() {
    showWishesAlert('');
    if (!state.wishesLoaded) {
      els.wishesLoading.classList.remove('hidden');
    }

    try {
      const data = await apiGetWishes();
      if (!data || !data.ok) {
        throw new Error((data && data.message) || 'Erro ao carregar a Lista de Presentes.');
      }
      renderWishes(data);
    } catch (err) {
      els.wishesLoading.classList.add('hidden');
      els.wishesSummary.textContent = 'Não foi possível carregar agora';
      showWishesAlert(
        (err && err.message) ||
          'Erro de conexão ao carregar a Lista de Presentes. Tente novamente.'
      );
    }
  }

  // Modal de Cadastro / Edição da Lista de Presentes
  function populateWishesParticipantSelect() {
    const names =
      state.participants.length > 0
        ? state.participants.map(function (p) {
            return p.name;
          })
        : state.wishlist.map(function (w) {
            return w.name;
          });

    if (names.length === 0) return;

    const currentValue = els.wishesParticipantSelect.value;
    els.wishesParticipantSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Selecione seu nome —';
    els.wishesParticipantSelect.appendChild(placeholder);

    const filledMap = {};
    state.wishlist.forEach(function (item) {
      if (item.wishes && item.wishes.length > 0) filledMap[item.name] = true;
    });

    names.forEach(function (name) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = filledMap[name] ? name + '  —  🎁 Já cadastrou' : name;
      els.wishesParticipantSelect.appendChild(opt);
    });

    if (currentValue && names.indexOf(currentValue) !== -1) {
      els.wishesParticipantSelect.value = currentValue;
    }
  }

  function syncWishesFormForParticipant(name) {
    showWishesFormError('');
    const existing = state.wishlist.find(function (item) {
      return item.name === name;
    });
    const wishes = existing && existing.wishes ? existing.wishes : [];

    els.wishInputs.forEach(function (input, idx) {
      input.value = wishes[idx] || '';
    });

    const hasExisting = wishes.length > 0;
    els.wishesExistingNotice.classList.toggle('hidden', !hasExisting);
    els.wishesConfirmWrap.classList.toggle('hidden', !hasExisting);
    els.wishesConfirmCheckbox.checked = false;
    els.wishesConfirmName.textContent = name || '';
  }

  async function openWishesModal() {
    if (!state.wishesLoaded) {
      await loadWishes();
    }
    populateWishesParticipantSelect();
    showWishesFormError('');

    const defaultName =
      state.lockedParticipant ||
      (readLocalLock() && readLocalLock().participant) ||
      els.select.value ||
      '';

    els.wishesParticipantSelect.value = defaultName;
    syncWishesFormForParticipant(defaultName);

    stopCarouselAutoplay();
    els.wishesModal.classList.remove('hidden');
    if (defaultName) {
      els.wishInputs[0].focus();
    } else {
      els.wishesParticipantSelect.focus();
    }
  }

  function closeWishesModal() {
    els.wishesModal.classList.add('hidden');
    startCarouselAutoplay();
  }

  async function handleSaveWishes(ev) {
    ev.preventDefault();
    if (state.isSavingWishes) return;

    showWishesFormError('');

    const participant = els.wishesParticipantSelect.value.trim();
    if (!participant) {
      showWishesFormError('Selecione o seu nome antes de salvar.');
      els.wishesParticipantSelect.focus();
      return;
    }

    const existing = state.wishlist.find(function (item) {
      return item.name === participant;
    });
    const isUpdating = Boolean(existing && existing.wishes && existing.wishes.length > 0);

    if (isUpdating && !els.wishesConfirmCheckbox.checked) {
      showWishesFormError('Marque a confirmação acima para atualizar os presentes de ' + participant + '.');
      return;
    }

    const wishes = els.wishInputs
      .map(function (input) {
        return input.value.replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);

    if (wishes.length === 0) {
      showWishesFormError('Preencha pelo menos 1 sugestão de presente.');
      els.wishInputs[0].focus();
      return;
    }

    if (wishes.length > MAX_WISHES) {
      showWishesFormError('Você pode cadastrar no máximo ' + MAX_WISHES + ' sugestões.');
      return;
    }

    state.isSavingWishes = true;
    els.wishesSaveBtn.disabled = true;
    els.wishesSaveBtn.textContent = 'Salvando...';

    try {
      const result = await apiSaveWishes(participant, wishes);
      if (!result || !result.ok) {
        showWishesFormError(
          (result && result.message) || 'Não foi possível salvar agora. Tente novamente.'
        );
        return;
      }

      closeWishesModal();
      renderWishes(result, participant);
      showToast('🎁 Lista de Presentes de ' + participant + ' salva!');
    } catch (err) {
      showWishesFormError(
        (err && err.message) || 'Erro de conexão ao salvar sua Lista de Presentes.'
      );
    } finally {
      state.isSavingWishes = false;
      els.wishesSaveBtn.disabled = false;
      els.wishesSaveBtn.textContent = '💾 Salvar presentes';
    }
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
      if (els.giftValueWishes) els.giftValueWishes.textContent = CONFIG.GIFT_VALUE;
    }
    if (IS_DEMO) {
      els.demoBanner.classList.remove('hidden');
    }
  }

  function bindEvents() {
    // Abas principais
    els.tabDraw.addEventListener('click', function () {
      switchTab('draw');
    });
    els.tabWishes.addEventListener('click', function () {
      switchTab('wishes');
    });
    if (els.goWishesFromLockedBtn) {
      els.goWishesFromLockedBtn.addEventListener('click', function () {
        switchTab('wishes');
      });
    }

    // Sorteio
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
      if (ev.target && ev.target.dataset && ev.target.dataset.closeModal === 'confirm') {
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

    // Lista de Presentes: modos, carrossel e busca
    els.modeCarouselBtn.addEventListener('click', function () {
      setWishesViewMode('carousel');
    });
    els.modeListBtn.addEventListener('click', function () {
      setWishesViewMode('list');
    });

    els.carouselPrevBtn.addEventListener('click', function () {
      goToSlide(state.carouselIndex - 1, false);
      startCarouselAutoplay();
    });
    els.carouselNextBtn.addEventListener('click', function () {
      goToSlide(state.carouselIndex + 1, false);
      startCarouselAutoplay();
    });

    // Sincroniza índice quando o usuário arrasta o carrossel com o dedo
    let scrollSyncTimer = null;
    els.carouselTrack.addEventListener('scroll', function () {
      if (scrollSyncTimer) clearTimeout(scrollSyncTimer);
      scrollSyncTimer = setTimeout(function () {
        const trackWidth = els.carouselTrack.clientWidth || 1;
        const approxIdx = Math.round(els.carouselTrack.scrollLeft / trackWidth);
        const total = getFilledWishes().length;
        if (approxIdx >= 0 && approxIdx < total && approxIdx !== state.carouselIndex) {
          state.carouselIndex = approxIdx;
          updateCarouselUI();
        }
      }, 90);
    });

    // Pausa auto-play ao interagir com o carrossel
    ['pointerenter', 'touchstart', 'focusin'].forEach(function (evtName) {
      els.wishesCarouselView.addEventListener(
        evtName,
        function () {
          state.carouselPaused = true;
          stopCarouselAutoplay();
        },
        { passive: true }
      );
    });
    ['pointerleave', 'focusout'].forEach(function (evtName) {
      els.wishesCarouselView.addEventListener(evtName, function () {
        state.carouselPaused = false;
        startCarouselAutoplay();
      });
    });

    els.wishesSearchInput.addEventListener('input', function () {
      state.wishesSearch = els.wishesSearchInput.value;
      renderWishesList();
    });

    // Modal de Cadastro de Presentes
    els.openWishesModalBtn.addEventListener('click', openWishesModal);
    els.wishesModalCloseBtn.addEventListener('click', closeWishesModal);
    els.wishesCancelBtn.addEventListener('click', closeWishesModal);
    els.wishesModal.addEventListener('click', function (ev) {
      if (ev.target && ev.target.dataset && ev.target.dataset.closeModal === 'wishes') {
        closeWishesModal();
      }
    });

    els.wishesParticipantSelect.addEventListener('change', function () {
      syncWishesFormForParticipant(els.wishesParticipantSelect.value);
    });

    els.wishesForm.addEventListener('submit', handleSaveWishes);

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (!els.confirmModal.classList.contains('hidden')) closeConfirmModal();
        if (!els.wishesModal.classList.contains('hidden')) closeWishesModal();
      }
    });

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
  // Pré-carrega contador da Lista de Presentes em segundo plano
  loadWishes();
})();
