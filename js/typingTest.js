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

    this.initializeElements();
    this.attachEventListeners();
    this.loadText();
    this.resetTest();
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

    window.addEventListener('resize', () => this.updateMetrics());

    this.input.addEventListener('input', (event) => this.handleInput(event));

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace') {
        event.preventDefault();
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
      this.input.focus();
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

      if (shareOutcome?.method === 'native') {
        this.setShareStatus('Поделились через системное меню.');
      } else if (shareOutcome) {
        const parts = [];
        if (shareOutcome.opened) {
          parts.push('Открыл Telegram в новой вкладке.');
        } else {
          parts.push('Не удалось автоматически открыть Telegram.');
        }
        if (shareOutcome.clipboard) {
          parts.push('Текст уже в буфере обмена.');
        } else if (shareOutcome.text) {
          parts.push(`Скопируй текст вручную: ${shareOutcome.text}`);
        }
        parts.push('Картинка скачана на устройство.');
        this.setShareStatus(parts.join(' '));
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
