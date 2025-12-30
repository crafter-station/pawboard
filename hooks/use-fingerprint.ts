"use client";

import { useEffect, useState } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const STORAGE_KEY = "pawboard_user_id";

export function useFingerprint() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setVisitorId(stored);
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const id = result.visitorId;
        localStorage.setItem(STORAGE_KEY, id);
        setVisitorId(id);
      } catch {
        const fallback = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, fallback);
        setVisitorId(fallback);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { visitorId, isLoading };
}
