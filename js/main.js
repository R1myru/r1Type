document.addEventListener('DOMContentLoaded', () => {
  const TypingTestClass = window.r1Type?.TypingTest;
  if (typeof TypingTestClass === 'function') {
    new TypingTestClass();
  } else {
    console.error('r1Type.TypingTest не загружен');
  }
});
