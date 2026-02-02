"use client";

import { useEffect, useRef } from "react";
import { Cursor } from "@/components/cursor";
import { useRealtimeCursors } from "@/hooks/use-realtime-cursors";

interface Point {
  x: number;
  y: number;
}

const THROTTLE_MS = 50;

interface RealtimeCursorsProps {
  roomName: string;
  username: string;
  screenToWorld: (screen: Point) => Point;
  worldToScreen: (world: Point) => Point;
  // Viewport prop triggers re-renders during pan/zoom so cursors move with the board
  viewport: { x: number; y: number; zoom: number };
}

export const RealtimeCursors = ({
  roomName,
  username,
  screenToWorld,
  worldToScreen,
  viewport,
}: RealtimeCursorsProps) => {
  const { cursors } = useRealtimeCursors({
    roomName,
    username,
    throttleMs: THROTTLE_MS,
    screenToWorld,
  });

  // Track previous viewport to detect viewport-driven updates
  const prevViewportRef = useRef(viewport);
  const isViewportChange =
    prevViewportRef.current.x !== viewport.x ||
    prevViewportRef.current.y !== viewport.y ||
    prevViewportRef.current.zoom !== viewport.zoom;

  // Update ref after render
  useEffect(() => {
    prevViewportRef.current = viewport;
  });

  return (
    <div className="pointer-events-none">
      {Object.keys(cursors).map((id) => {
        const screenPos = worldToScreen(cursors[id].position);
        return (
          <Cursor
            key={id}
            x={screenPos.x}
            y={screenPos.y}
            color={cursors[id].color}
            cursorImage={cursors[id].cursorImage}
            name={cursors[id].user.name}
            instant={isViewportChange}
          />
        );
      })}
    </div>
  );
};
