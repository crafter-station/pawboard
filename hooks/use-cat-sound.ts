import { useCallback, useRef } from "react";

export function useCatSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/cat_sound.mp3");
      audioRef.current.volume = 0.3;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  return playSound;
}
