// Tiptap utility functions for both server and client use
// NO "use client" directive - this is a shared utility module

import type { TiptapContent } from "@/db/schema";

// Type for extracting from nodes
interface TiptapNode {
  type: string;
  text?: string;
  content?: TiptapNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Check if Tiptap content is empty (no text content)
 */
export function isContentEmpty(content: TiptapContent): boolean {
  if (!content || !content.content) return true;
  if (content.content.length === 0) return true;
  if (content.content.length === 1) {
    const firstNode = content.content[0];
    if (firstNode.type === "paragraph" && !firstNode.content) return true;
    if (
      firstNode.type === "paragraph" &&
      firstNode.content &&
      firstNode.content.length === 0
    )
      return true;
  }
  return false;
}

/**
 * Extract plain text from Tiptap JSON content
 */
export function extractTextFromTiptap(content: TiptapContent): string {
  if (!content || !content.content) return "";

  const extractFromNode = (node: TiptapNode): string => {
    if (!node) return "";

    // Text node
    if (node.type === "text" && node.text) {
      return node.text;
    }

    // Node with content array
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractFromNode).join("");
    }

    return "";
  };

  return (content.content as TiptapNode[])
    .map((node) => {
      const text = extractFromNode(node);
      // Add newline after block-level elements
      if (
        node.type === "paragraph" ||
        node.type === "bulletList" ||
        node.type === "taskList"
      ) {
        return text + "\n";
      }
      return text;
    })
    .join("")
    .trim();
}

/**
 * Create Tiptap content from plain text
 */
export function createTiptapContent(text: string): TiptapContent {
  if (!text || text.trim() === "") {
    return {
      type: "doc",
      content: [{ type: "paragraph" }],
    };
  }

  const paragraphs = text.split("\n").filter((line) => line.trim() !== "");

  return {
    type: "doc",
    content: paragraphs.map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    })),
  };
}
