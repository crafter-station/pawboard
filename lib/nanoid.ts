import { nanoid } from "nanoid";

export function generateSessionId() {
  return nanoid(10);
}

export function generateCardId() {
  return nanoid(12);
}

export function generateFileId() {
  return nanoid(16);
}

export function generateChunkId() {
  return nanoid(20);
}
