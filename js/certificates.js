const certificateLevels = {
  platinum: { minSpeed: 350, minAccuracy: 99.5, color: '#E5E4E2', name: 'платинового' },
  gold: { minSpeed: 250, minAccuracy: 98.7, color: '#FFD700', name: 'золотого' },
  silver: { minSpeed: 200, minAccuracy: 96, color: '#C0C0C0', name: 'серебряного' },
  bronze: { minSpeed: 150, minAccuracy: 90, color: '#CD7F32', name: 'бронзового' }
};

const timeOptions = {
  60: '1 мин',
  120: '2 мин',
  300: '5 мин'
};

if (typeof window !== 'undefined') {
  window.r1Type = window.r1Type || {};
  window.r1Type.certificateLevels = certificateLevels;
  window.r1Type.timeOptions = timeOptions;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { certificateLevels, timeOptions };
}
