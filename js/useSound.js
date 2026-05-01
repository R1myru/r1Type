import { useRef } from 'react';

export const useTypingSound = (soundPath) => {
  const audioRef = useRef(new Audio(soundPath));

  const playSound = () => {
    // Сбрасываем время в начало, чтобы звук мог проигрываться быстро при частом нажатии
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  return playSound;
};
