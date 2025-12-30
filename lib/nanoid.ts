import { nanoid } from "nanoid";

export function generateSessionId() {
  return nanoid(10);
}

export function generateCardId() {
  return nanoid(12);
}
