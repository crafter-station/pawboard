"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { getRandomTip } from "@/lib/loading-tips";

const MIN_DISPLAY_MS = 3000;

interface LoadingTipProps {
  isReady: boolean;
  onComplete: () => void;
}

export function LoadingTip({ isReady, onComplete }: LoadingTipProps) {
  const tip = useRef(getRandomTip());
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && minTimeElapsed) {
      onComplete();
    }
  }, [isReady, minTimeElapsed, onComplete]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center gap-4 max-w-md text-center"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🐾</span>
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Did you know?
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tip.current}
        </p>
        <div className="flex gap-1 pt-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Number.POSITIVE_INFINITY,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
