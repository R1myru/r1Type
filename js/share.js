const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;
const BRAND_PRIMARY = '#1D85E9';
const BRAND_DARK = '#302F2C';
const BRAND_LIGHT = '#F3F3F3';

function drawShareImage(context, stats) {
  context.fillStyle = BRAND_PRIMARY;
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);

  const gradient = context.createLinearGradient(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);
  gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(48,47,44,0.25)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, SHARE_IMAGE_WIDTH, SHARE_IMAGE_HEIGHT);

  context.fillStyle = BRAND_LIGHT;
  context.font = 'bold 72px "Segoe UI", sans-serif';
  context.textAlign = 'left';
  context.fillText('r1Type', 80, 140);

  context.font = '48px "Segoe UI", sans-serif';
  context.fillText('Мой результат', 80, 220);

  context.font = 'bold 120px "Segoe UI", sans-serif';
  context.fillText(`${stats.speed} зн./мин`, 80, 360);

  context.font = '48px "Segoe UI", sans-serif';
  context.fillText(`${stats.wpm} сл./мин`, 80, 430);

  context.font = '42px "Segoe UI", sans-serif';
  context.fillText(`Точность: ${stats.accuracy.toFixed(1)}%`, 80, 500);

  context.font = '32px "Segoe UI", sans-serif';
  context.fillText(`Время: ${stats.timeLabel}`, 80, 560);

  context.fillStyle = 'rgba(255,255,255,0.3)';
  context.font = '26px "Segoe UI", sans-serif';
  context.textAlign = 'right';
  context.fillText('Проверь свою скорость на r1my.ru/type', SHARE_IMAGE_WIDTH - 80, SHARE_IMAGE_HEIGHT - 80);
}

async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.92));
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function formatShareText({ speed, wpm, accuracy }) {
  const accuracyStr = accuracy.toFixed(1).replace('.', ',');
  return `Ахуеть, я печатаю со скоростью ${speed} зн./мин (${wpm} сл./мин) с точностью ${accuracyStr}% в r1Type!`;
}

function humanizeTime(seconds) {
  if (seconds >= 60) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} мин`;
  }
  return `${Math.round(seconds)} сек`;
}

async function createShareImage(stats) {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_IMAGE_WIDTH;
  canvas.height = SHARE_IMAGE_HEIGHT;

  const context = canvas.getContext('2d');
  drawShareImage(context, stats);

  const blob = await canvasToBlob(canvas);
  return { blob, canvas };
}

async function shareResults({ speed, wpm, accuracy, elapsedSeconds }) {
  const sharePayload = {
    speed,
    wpm,
    accuracy,
    timeLabel: humanizeTime(elapsedSeconds)
  };

  const shareText = formatShareText(sharePayload);
  const shareUrl = `https://t.me/share/url?${new URLSearchParams({ text: shareText })}`;

  let blob = null;

  if (navigator.share) {
    try {
      blob = blob || (await createShareImage(sharePayload)).blob;
      const file = new File([blob], 'r1type-result.png', { type: 'image/png' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'r1Type результат',
          text: shareText,
          files: [file]
        });
        return { method: 'native', text: shareText };
      }
    } catch (error) {
      console.warn('Native share failed, using fallback', error);
    }
  }

  const shareWindow = window.open('about:blank', '_blank', 'noopener');
  if (shareWindow) {
    shareWindow.location = shareUrl;
  }

  let clipboardSuccess = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(shareText);
      clipboardSuccess = true;
    } catch (error) {
      clipboardSuccess = false;
    }
  }

  if (!blob) {
    blob = (await createShareImage(sharePayload)).blob;
  }

  downloadBlob(blob, 'r1type-result.png');

  return {
    method: 'fallback',
    text: shareText,
    opened: !!shareWindow,
    clipboard: clipboardSuccess
  };
}

if (typeof window !== 'undefined') {
  window.r1Type = window.r1Type || {};
  window.r1Type.share = {
    createShareImage,
    shareResults
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createShareImage, shareResults };
}
