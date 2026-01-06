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
}

export const RealtimeCursors = ({
  roomName,
  username,
  screenToWorld,
}: RealtimeCursorsProps) => {
  const { cursors } = useRealtimeCursors({
    roomName,
    username,
    throttleMs: THROTTLE_MS,
    screenToWorld,
  });

  return (
    <div className="pointer-events-none">
      {Object.keys(cursors).map((id) => (
        <Cursor
          key={id}
          x={cursors[id].position.x}
          y={cursors[id].position.y}
          color={cursors[id].color}
          cursorImage={cursors[id].cursorImage}
          name={cursors[id].user.name}
          timestamp={cursors[id].timestamp}
        />
      ))}
    </div>
  );
};
