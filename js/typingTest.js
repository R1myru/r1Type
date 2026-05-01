const DASH_SANITIZER = /[\u2013\u2014]/g;
const r1TypeNamespace = (typeof window !== 'undefined' && window.r1Type) || {};
const TEXT_DATABASE =
  r1TypeNamespace.textsDatabase || (typeof window !== 'undefined' ? window.textsDatabase : {}) || {};
const CERTIFICATE_LEVELS = r1TypeNamespace.certificateLevels || {};
const shareResultsFn = r1TypeNamespace.share?.shareResults;

class TypingTest {
  constructor() {
    this.currentLanguage = 'ru';
    this.currentTime = 60;
    this.sampleText = '';
    this.timer = null;
    this.time = 0;
    this.pos = 0;
    this.errors = 0;
    this.started = false;
    this.startTime = 0;
    this.errorTimeout = null;
    this.errorFlashTarget = null;
    this.scrollOffset = 0;
    this.lineHeight = 0;
    this.viewportHeight = 0;
    this.lastResults = null;

    this.defaultSoundVolume = 0.25;
    this.soundVolume = this.readStoredSoundVolume();
    this.soundMuted = this.readStoredSoundMuted();
    this.soundIndex = 0;
    this.clickSoundUrl = new URL('js/sounds/clicks.mp3', window.location.href).href;
    this.audioContext = null;
    this.clickBuffer = null;
    this.clickBufferPromise = null;
    this.fallbackClickSounds = this.createFallbackClickSounds();

    this.initializeElements();
    this.attachEventListeners();
    this.updateSoundControls();
    this.loadText();
    this.resetTest();
  }

  readStoredSoundVolume() {
    try {
      const storedValue = window.localStorage?.getItem('r1TypeSoundVolume');
      const value = storedValue === null ? NaN : Number(storedValue);
      if (Number.isFinite(value) && value >= 0 && value <= 1) {
        return value;
      }
    } catch (error) {
      return this.defaultSoundVolume;
    }

    return this.defaultSoundVolume;
  }

  readStoredSoundMuted() {
    try {
      return window.localStorage?.getItem('r1TypeSoundMuted') === 'true';
    } catch (error) {
      return false;
    }
  }

  createFallbackClickSounds() {
    return Array.from({ length: 6 }, () => {
      const sound = new Audio(this.clickSoundUrl);
      sound.preload = 'auto';
      sound.volume = this.getEffectiveSoundVolume();
      sound.load();
      return sound;
    });
  }

  async playClick() {
    if (this.getEffectiveSoundVolume() <= 0) {
      return;
    }

    const context = this.getAudioContext();

    if (context) {
      try {
        if (context.state === 'suspended') {
          await context.resume();
        }

        if (!this.clickBufferPromise) {
          this.clickBufferPromise = this.loadClickBuffer();
        }

        if (this.clickBuffer) {
          this.playBufferedClick(context);
        } else {
          this.playGeneratedClick(context);
        }
      } catch (error) {
        this.playFallbackClick();
      }

      return;
    }

    this.playFallbackClick();
  }

  getEffectiveSoundVolume() {
    return this.soundMuted ? 0 : this.soundVolume;
  }

  updateFallbackSoundVolume() {
    const volume = this.getEffectiveSoundVolume();
    this.fallbackClickSounds.forEach((sound) => {
      sound.volume = volume;
    });
  }

  saveSoundSettings() {
    try {
      window.localStorage?.setItem('r1TypeSoundVolume', String(this.soundVolume));
      window.localStorage?.setItem('r1TypeSoundMuted', String(this.soundMuted));
    } catch (error) {
      // Настройка звука останется активной до перезагрузки страницы.
    }
  }

  updateSoundControls() {
    if (!this.soundVolumeInput || !this.soundToggle) {
      return;
    }

    const volumePercent = Math.round(this.soundVolume * 100);
    const effectivePercent = Math.round(this.getEffectiveSoundVolume() * 100);

    this.soundVolumeInput.value = String(volumePercent);
    this.soundToggle.textContent = effectivePercent > 0 ? '🔊' : '🔇';
    this.soundToggle.classList.toggle('is-muted', effectivePercent === 0);
    this.soundToggle.setAttribute(
      'aria-label',
      effectivePercent > 0 ? 'Выключить звук' : 'Включить звук'
    );
    this.soundToggle.title = effectivePercent > 0 ? 'Выключить звук' : 'Включить звук';

    if (this.soundValue) {
      this.soundValue.textContent = effectivePercent > 0 ? `${effectivePercent}%` : 'Выкл';
    }
  }

  setSoundVolume(value) {
    const nextVolume = Math.min(Math.max(Number(value) / 100, 0), 1);
    this.soundVolume = Number.isFinite(nextVolume) ? nextVolume : this.defaultSoundVolume;
    this.soundMuted = this.soundVolume === 0;
    this.updateFallbackSoundVolume();
    this.updateSoundControls();
    this.saveSoundSettings();
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;

    if (!this.soundMuted && this.soundVolume === 0) {
      this.soundVolume = this.defaultSoundVolume;
    }

    this.updateFallbackSoundVolume();
    this.updateSoundControls();
    this.saveSoundSettings();
  }

  getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }

    return this.audioContext;
  }

  async loadClickBuffer() {
    try {
      const context = this.getAudioContext();
      const response = await fetch(this.clickSoundUrl);
      if (!context || !response.ok) {
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      this.clickBuffer = await context.decodeAudioData(arrayBuffer);
    } catch (error) {
      this.clickBuffer = null;
    }
  }

  playBufferedClick(context) {
    const source = context.createBufferSource();
    const gain = context.createGain();

    source.buffer = this.clickBuffer;
    gain.gain.value = this.getEffectiveSoundVolume();
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  }

  playGeneratedClick(context) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.18 * this.getEffectiveSoundVolume(), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.035);
  }

  playFallbackClick() {
    if (!this.fallbackClickSounds.length) {
      return;
    }

    const sound = this.fallbackClickSounds[this.soundIndex];
    this.soundIndex = (this.soundIndex + 1) % this.fallbackClickSounds.length;
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }

  shouldPlayClickForKey(event) {
    return event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;
  }

  initializeElements() {
    this.typer = document.getElementById('typer');
    this.typerContent = document.getElementById('typerContent');
    this.input = document.getElementById('input');
    this.timerEl = document.getElementById('timer');
    this.restartBtn = document.getElementById('restart');
    this.shareBtn = document.getElementById('share');
    this.shareStatus = document.getElementById('shareStatus');
    this.stats = document.getElementById('stats');
    this.certificate = document.getElementById('certificate');
    this.progressFill = document.getElementById('progressFill');
    this.speedEl = document.getElementById('speed');
    this.wpmEl = document.getElementById('wpm');
    this.accuracyEl = document.getElementById('accuracy');
    this.speedUnit = document.getElementById('speedUnit');
    this.certIcon = document.getElementById('certIcon');
    this.certLevel = document.getElementById('certLevel');
    this.timeSelect = document.getElementById('timeSelect');
    this.languageSelect = document.getElementById('languageSelect');
    this.soundToggle = document.getElementById('soundToggle');
    this.soundVolumeInput = document.getElementById('soundVolume');
    this.soundValue = document.getElementById('soundValue');
    this.activeTest = document.getElementById('activeTest');
    this.resultsSection = document.getElementById('resultsSection');
    this.instructions = document.querySelector('.instructions');
  }

  attachEventListeners() {
    this.typer.addEventListener('click', () => this.focusInput());

    this.restartBtn.addEventListener('click', () => {
      this.loadText();
      this.resetTest();
      this.focusInput();
    });

    this.shareBtn.addEventListener('click', () => this.handleShareClick());

    this.timeSelect.addEventListener('change', (event) => {
      this.currentTime = parseInt(event.target.value, 10);
      this.loadText();
      this.resetTest();
    });

    this.languageSelect.addEventListener('change', (event) => {
      this.currentLanguage = event.target.value;
      this.loadText();
      this.resetTest();
    });

    if (this.soundToggle) {
      this.soundToggle.addEventListener('click', () => this.toggleSound());
    }

    if (this.soundVolumeInput) {
      this.soundVolumeInput.addEventListener('input', (event) => this.setSoundVolume(event.target.value));
      this.soundVolumeInput.addEventListener('change', (event) => this.setSoundVolume(event.target.value));
    }

    window.addEventListener('resize', () => this.updateMetrics());

    this.input.addEventListener('input', (event) => this.handleInput(event));

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace') {
        event.preventDefault();
        return;
      }

      if (this.shouldPlayClickForKey(event)) {
        this.playClick();
      }
    });
  }

  loadText() {
    const availableTexts = Array.isArray(TEXT_DATABASE[this.currentLanguage])
      ? TEXT_DATABASE[this.currentLanguage]
      : Array.isArray(TEXT_DATABASE.ru)
        ? TEXT_DATABASE.ru
        : [];

    const rawText = availableTexts.length > 0
      ? availableTexts[Math.floor(Math.random() * availableTexts.length)]
      : '';

    if (rawText) {
      this.sampleText = rawText.replace(DASH_SANITIZER, '-');
    } else {
      this.sampleText = 'Тексты не загрузились. Обнови страницу или проверь scripts.';
    }
    this.updateSpeedUnit();
  }

  resetTest() {
    clearInterval(this.timer);
    this.timer = null;
    this.time = this.currentTime;
    this.pos = 0;
    this.errors = 0;
    this.started = false;
    this.startTime = 0;
    this.scrollOffset = 0;
    this.lastResults = null;

    this.updateTimerDisplay();
    this.input.value = '';
    this.input.disabled = false;
    this.activeTest.classList.remove('hidden');
    this.resultsSection.classList.add('hidden');
    this.stats.classList.add('hidden');
    this.certificate.classList.add('hidden');
    this.progressFill.style.width = '0%';
    this.typerContent.style.transform = 'translateY(0)';
    this.clearErrorFlash();
    this.setShareStatus('');
    this.toggleShareAvailability(false);

    if (this.instructions) {
      this.instructions.classList.remove('hidden');
    }

    this.updateMetrics();
    this.renderText(true);

    setTimeout(() => this.focusInput(), 200);
  }

  focusInput() {
    if (document.activeElement !== this.input) {
      try {
        this.input.focus({ preventScroll: true });
      } catch (error) {
        this.input.focus();
      }
    }
  }

  handleInput(event) {
    let value = event.target.value;

    if (!this.started && value.length > 0) {
      this.started = true;
      this.startTime = Date.now();
      this.timer = setInterval(() => this.tick(), 1000);
      if (this.instructions) {
        this.instructions.classList.add('hidden');
      }
    }

    if (value.length < this.pos) {
      event.target.value = this.sampleText.slice(0, this.pos);
      return;
    }

    if (value.length > this.sampleText.length) {
      value = value.slice(0, this.sampleText.length);
      event.target.value = value;
    }

    for (let index = this.pos; index < value.length; index += 1) {
      const expected = this.sampleText[index];
      const actual = value[index];

      if (actual === expected) {
        this.pos += 1;
      } else {
        this.errors += 1;
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        event.target.value = this.sampleText.slice(0, this.pos);
        this.renderText();
        this.flashError();
        return;
      }
    }

    this.input.value = this.sampleText.slice(0, this.pos);
    this.renderText();

    if (this.pos === this.sampleText.length) {
      this.finishTest();
    }
  }

  tick() {
    this.time -= 1;
    this.updateTimerDisplay();

    if (this.time <= 0) {
      this.finishTest();
    }
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.time / 60);
    const seconds = Math.max(this.time % 60, 0);
    this.timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  renderText(force = false) {
    const typedLength = this.pos;
    let html = '';

    for (let i = 0; i < this.sampleText.length; i += 1) {
      let cls;
      if (i < typedLength) {
        cls = 'typed';
      } else if (i === typedLength && typedLength < this.sampleText.length) {
        cls = 'current';
      } else {
        cls = 'notyet';
      }

      const char = this.escapeChar(this.sampleText[i]);
      html += `<span class="${cls}">${char}</span>`;
    }

    if (this.sampleText.length === 0) {
      html = '<span class="notyet">&nbsp;</span>';
    }

    this.typerContent.innerHTML = html;

    const progressBase = this.sampleText.length || 1;
    const progress = (typedLength / progressBase) * 100;
    this.progressFill.style.width = `${progress}%`;

    if (force) {
      this.scrollOffset = 0;
      this.typerContent.style.transform = 'translateY(0)';
    }

    this.ensureCaretVisible();
  }

  ensureCaretVisible() {
    const caret = this.typerContent.querySelector('.current') || this.typerContent.lastElementChild;
    if (!caret) {
      return;
    }

    if (!this.viewportHeight) {
      this.updateMetrics();
    }

    const viewHeight = this.viewportHeight || this.typer.clientHeight || 1;
    const caretTop = caret.offsetTop;
    const caretBottom = caretTop + caret.offsetHeight;

    const upperPadding = this.lineHeight * 0.5;
    const lowerPadding = this.lineHeight * 1.5;

    let offset = this.scrollOffset || 0;

    if (caretTop - offset < upperPadding) {
      offset = Math.max(0, caretTop - upperPadding);
    } else if (caretBottom - offset > viewHeight - lowerPadding) {
      offset = Math.max(0, caretBottom - (viewHeight - lowerPadding));
    }

    this.scrollOffset = offset;
    this.typerContent.style.transform = `translateY(-${offset}px)`;
  }

  escapeChar(char) {
    if (char === '&') {
      return '&amp;';
    }
    if (char === '<') {
      return '&lt;';
    }
    if (char === '>') {
      return '&gt;';
    }
    return char;
  }

  flashError() {
    const caret = this.typerContent.querySelector('.current');
    if (!caret) {
      return;
    }

    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }

    if (this.errorFlashTarget) {
      this.errorFlashTarget.classList.remove('flash-error');
      this.errorFlashTarget = null;
    }

    caret.classList.add('flash-error');
    this.errorFlashTarget = caret;

    this.errorTimeout = setTimeout(() => {
      if (this.errorFlashTarget) {
        this.errorFlashTarget.classList.remove('flash-error');
        this.errorFlashTarget = null;
      }
      this.errorTimeout = null;
    }, 500);
  }

  clearErrorFlash() {
    if (this.errorTimeout) {
      clearTimeout(this.errorTimeout);
      this.errorTimeout = null;
    }
    if (this.errorFlashTarget) {
      this.errorFlashTarget.classList.remove('flash-error');
      this.errorFlashTarget = null;
    }
  }

  updateMetrics() {
    if (!this.typer) {
      return;
    }
    const styles = window.getComputedStyle(this.typer);
    const lineHeight = parseFloat(styles.lineHeight);
    const fontSize = parseFloat(styles.fontSize);
    if (!Number.isNaN(lineHeight) && lineHeight > 0) {
      this.lineHeight = lineHeight;
    } else if (!Number.isNaN(fontSize) && fontSize > 0) {
      this.lineHeight = fontSize * 1.4;
    } else {
      this.lineHeight = 32;
    }
    this.viewportHeight = this.typer.clientHeight || 0;
  }

  updateSpeedUnit() {
    const units = {
      ru: 'зн./мин',
      uk: 'зн./мин',
      en: 'wpm',
      es: 'ppm',
      fr: 'mpm',
      de: 'apm'
    };
    this.speedUnit.textContent = units[this.currentLanguage] || 'зн./мин';
  }

  calculateElapsedSeconds() {
    if (this.started && this.startTime) {
      const diff = (Date.now() - this.startTime) / 1000;
      if (diff > 0.5) {
        return diff;
      }
    }
    return this.currentTime - this.time;
  }

  calculateResults() {
    const correct = this.pos;
    const attempts = Math.max(correct + this.errors, correct);
    const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0;

    const elapsedSeconds = Math.max(this.calculateElapsedSeconds(), 1);
    const minutesFactor = 60 / elapsedSeconds;

    let speed;
    let wpm;

    if (this.currentLanguage === 'ru' || this.currentLanguage === 'uk') {
      speed = Math.round(correct * minutesFactor);
      wpm = Math.round(speed / 5);
    } else {
      wpm = Math.round((correct / 5) * minutesFactor);
      speed = wpm * 5;
    }

    return { correct, attempts, accuracy, speed, wpm, elapsedSeconds };
  }

  finishTest() {
    if (!this.started) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    this.input.blur();
    this.input.value = this.sampleText.slice(0, this.pos);
    this.clearErrorFlash();
    this.renderText(true);

    const results = this.calculateResults();
    this.lastResults = results;

    this.activeTest.classList.add('hidden');
    this.resultsSection.classList.remove('hidden');
    this.input.disabled = true;

    this.showResults(results);
    this.showCertificate(results);
    this.toggleShareAvailability(true);

    setTimeout(() => this.restartBtn.focus(), 200);
  }

  showResults({ speed, wpm, accuracy }) {
    this.stats.classList.remove('hidden');
    this.speedEl.textContent = speed;
    this.wpmEl.textContent = wpm;
    this.accuracyEl.textContent = `${accuracy.toFixed(1)}%`;
  }

  showCertificate({ speed, accuracy }) {
    const certificate = Object.entries(CERTIFICATE_LEVELS).find(([, requirements]) => {
      return speed >= requirements.minSpeed && accuracy >= requirements.minAccuracy;
    });

    if (!certificate) {
      this.certificate.classList.add('hidden');
      return;
    }

    const [, requirements] = certificate;
    this.certificate.classList.remove('hidden');
    this.certLevel.textContent = `Сертификат ${requirements.name} уровня`;
    this.certIcon.style.color = requirements.color;

    requestAnimationFrame(() => {
      this.certificate.style.transform = 'scale(1.05)';
      setTimeout(() => {
        this.certificate.style.transform = 'scale(1)';
      }, 200);
    });
  }

  toggleShareAvailability(enabled) {
    if (!this.shareBtn) {
      return;
    }

    this.shareBtn.disabled = !enabled;
    this.shareBtn.classList.toggle('hidden', !enabled);

    if (!enabled) {
      this.shareBtn.setAttribute('aria-disabled', 'true');
    } else {
      this.shareBtn.removeAttribute('aria-disabled');
    }
  }

  async handleShareClick() {
    if (!this.lastResults) {
      return;
    }

    try {
      this.shareBtn.disabled = true;
      this.setShareStatus('Готовим карточку…');
      let shareOutcome = null;
      if (typeof shareResultsFn === 'function') {
        shareOutcome = await shareResultsFn(this.lastResults);
      }

      if (shareOutcome?.method === 'download') {
        const suffix = shareOutcome.text ? ` Текст для подписи: ${shareOutcome.text}` : '';
        this.setShareStatus(`Картинка скачана на устройство.${suffix}`);
      } else if (shareOutcome?.method === 'native') {
        this.setShareStatus('Поделились через системное меню.');
      } else {
        this.setShareStatus('Функция шаринга недоступна.');
      }
    } catch (error) {
      console.error('Share error', error);
      this.setShareStatus('Не получилось поделиться. Попробуй ещё раз.');
    } finally {
      this.shareBtn.disabled = false;
    }
  }

  setShareStatus(message) {
    if (!this.shareStatus) {
      return;
    }

    if (message) {
      this.shareStatus.textContent = message;
      this.shareStatus.classList.remove('hidden');
    } else {
      this.shareStatus.textContent = '';
      this.shareStatus.classList.add('hidden');
    }
  }
}

if (typeof window !== 'undefined') {
  window.r1Type = window.r1Type || {};
  window.r1Type.TypingTest = TypingTest;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TypingTest };
}
