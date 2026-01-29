import { useCallback, useEffect, useRef } from "react";

export function useCatSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

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
