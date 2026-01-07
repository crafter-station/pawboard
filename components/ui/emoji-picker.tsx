"use client";

import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface EmojiData {
  id: string;
  name: string;
  native: string;
  unified: string;
  keywords: string[];
  shortcodes: string;
}

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-[352px] h-[435px] flex items-center justify-center bg-popover rounded-lg">
        <div className="animate-pulse text-muted-foreground text-sm">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <Picker
      data={data}
      onEmojiSelect={(emoji: EmojiData) => onEmojiSelect(emoji.native)}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      previewPosition="none"
      skinTonePosition="search"
      maxFrequentRows={2}
      navPosition="top"
      perLine={9}
      emojiButtonSize={36}
      emojiSize={22}
      set="native"
      categories={[
        "frequent",
        "people",
        "nature",
        "foods",
        "activity",
        "places",
        "objects",
        "symbols",
        "flags",
      ]}
      icons="outline"
    />
  );
}
