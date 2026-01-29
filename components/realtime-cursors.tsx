"use client";

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
}

export const RealtimeCursors = ({
  roomName,
  username,
  screenToWorld,
  worldToScreen,
}: RealtimeCursorsProps) => {
  const { cursors } = useRealtimeCursors({
    roomName,
    username,
    throttleMs: THROTTLE_MS,
    screenToWorld,
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
          />
        );
      })}
    </div>
  );
};
