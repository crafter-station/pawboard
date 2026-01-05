"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { GithubLogo } from "@/components/logos/github";
import { useCatSound } from "@/hooks/use-cat-sound";

export function GithubBadge() {
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const playSound = useCatSound();

  useEffect(() => {
    const fetchGithubStars = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/crafter-station/pawboard",
        );
        if (response.ok) {
          const data = await response.json();
          setGithubStars(data.stargazers_count);
        }
      } catch (error) {
        console.warn("Failed to fetch GitHub stars:", error);
      }
    };
    fetchGithubStars();
  }, []);

  return (
    <>
      <motion.a
        href="https://github.com/crafter-station/pawboard"
        target="_blank"
        rel="noopener noreferrer"
        onClick={playSound}
        className="github-badge flex items-center gap-2 px-3 py-1.5 bg-card/60 backdrop-blur-sm border border-border/50 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-300"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0.8 }}
        whileHover={{ opacity: 1 }}
      >
        <GithubLogo className="w-4 h-4" />

        {githubStars !== null && (
          <motion.span
            className="text-xs font-medium flex items-center gap-1"
            key={githubStars}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-amber-500"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {githubStars}
          </motion.span>
        )}
      </motion.a>
    </>
  );
}
