"use client";

import { cn } from "@/lib/utils";
import { createRef, ReactNode, useRef } from "react";

interface ImageMouseTrailProps {
  items: string[];
  children?: ReactNode;
  className?: string;
  imgClass?: string;
  distance?: number;
  maxNumberOfImages?: number;
  fadeAnimation?: boolean;
}

export function ImageMouseTrail({
  items,
  children,
  className,
  maxNumberOfImages = 5,
  imgClass = "w-40 h-48",
  distance = 20,
  fadeAnimation = false,
}: ImageMouseTrailProps) {
  const containerRef = useRef<HTMLElement>(null);
  const refs = useRef(items.map(() => createRef<HTMLImageElement>()));
  const currentZIndexRef = useRef(1);
  const globalIndexRef = useRef(0);
  const lastRef = useRef({ x: 0, y: 0 });

  const activate = (image: HTMLImageElement, x: number, y: number) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const relativeX = x - containerRect.left;
    const relativeY = y - containerRect.top;
    image.style.left = `${relativeX}px`;
    image.style.top = `${relativeY}px`;

    const rotation = Math.random() * 30 - 15;
    image.style.setProperty("--rotation", `${rotation}deg`);

    if (currentZIndexRef.current > 40) {
      currentZIndexRef.current = 1;
    }
    image.style.zIndex = String(currentZIndexRef.current);
    currentZIndexRef.current++;

    image.dataset.status = "active";
    if (fadeAnimation) {
      setTimeout(() => {
        image.dataset.status = "inactive";
      }, 600);
    }
    lastRef.current = { x, y };
  };

  const distanceFromLast = (x: number, y: number) => {
    return Math.hypot(x - lastRef.current.x, y - lastRef.current.y);
  };

  const deactivate = (image: HTMLImageElement) => {
    image.dataset.status = "inactive";
  };

  const handleOnMove = (e: { clientX: number; clientY: number }) => {
    if (distanceFromLast(e.clientX, e.clientY) > window.innerWidth / distance) {
      const lead =
        refs.current[globalIndexRef.current % refs.current.length].current;

      const tailIndex =
        globalIndexRef.current >= maxNumberOfImages
          ? (globalIndexRef.current - maxNumberOfImages) % refs.current.length
          : -1;
      const tail = tailIndex >= 0 ? refs.current[tailIndex]?.current : null;

      if (lead) activate(lead, e.clientX, e.clientY);
      if (tail) deactivate(tail);
      globalIndexRef.current++;
    }
  };

  return (
    <section
      onMouseMove={handleOnMove}
      onTouchMove={(e) => handleOnMove(e.touches[0])}
      ref={containerRef}
      className={cn(
        "grid place-content-center h-screen w-full relative overflow-visible",
        className,
      )}
    >
      {items.map((item, index) => (
        <img
          key={index}
          className={cn(
            "object-contain absolute -translate-y-1/2 -translate-x-1/2 pointer-events-none will-change-transform",
            "scale-0 opacity-0 rotate-0",
            "data-[status='active']:scale-100 data-[status='active']:opacity-100 data-[status='active']:rotate-[var(--rotation)]",
            "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "data-[status='inactive']:duration-300 data-[status='inactive']:ease-[cubic-bezier(0.4,0,0.2,1)]",
            imgClass,
          )}
          data-index={index}
          data-status="inactive"
          src={item}
          alt={`cursor-${index}`}
          ref={refs.current[index]}
        />
      ))}
      {children}
    </section>
  );
}
