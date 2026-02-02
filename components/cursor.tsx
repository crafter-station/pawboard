import { motion } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

export const Cursor = ({
  className,
  x,
  y,
  color,
  cursorImage,
  name,
  instant = false,
}: {
  className?: string;
  x: number;
  y: number;
  color: string;
  cursorImage: string;
  name: string;
  instant?: boolean;
}) => {
  const textColor = getContrastColor(color);

  return (
    <motion.div
      className={cn("pointer-events-none absolute", className)}
      style={{ zIndex: 2000 }}
      initial={{ x, y }}
      animate={{ x, y }}
      transition={
        instant
          ? { duration: 0 }
          : {
              type: "spring",
              damping: 30,
              mass: 0.8,
              stiffness: 350,
            }
      }
    >
      <Image
        src={cursorImage}
        alt="cursor"
        width={56}
        height={56}
        className="drop-shadow-md"
      />

      <div
        className="mt-1 px-2.5 py-1 rounded-full text-xs font-semibold text-center shadow-md border border-black/10"
        style={{
          backgroundColor: color,
          color: textColor,
        }}
      >
        {name}
      </div>
    </motion.div>
  );
};
