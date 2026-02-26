import type { TiptapContent } from "@/db/schema";

const REPLACEMENT_CHARS = "abcdefghijklmnopqrstuvwxyz";

function obfuscateText(text: string): string {
  return text
    .split("")
    .map((ch) => {
      if (/\s/.test(ch)) return ch; // preserve whitespace
      return REPLACEMENT_CHARS[
        Math.floor(Math.random() * REPLACEMENT_CHARS.length)
      ];
    })
    .join("");
}

// biome-ignore lint/suspicious/noExplicitAny: TiptapContent nodes have dynamic shape
function obfuscateNode(node: any): any {
  if (node.type === "text" && node.text) {
    return { ...node, text: obfuscateText(node.text) };
  }
  if (node.content && Array.isArray(node.content)) {
    return { ...node, content: node.content.map(obfuscateNode) };
  }
  return node;
}

/**
 * Obfuscates all text content in a TiptapContent document by replacing
 * non-whitespace characters with random lowercase letters.
 * Preserves JSON structure, paragraph breaks, marks/formatting, and whitespace.
 */
export function obfuscateTiptapContent(content: TiptapContent): TiptapContent {
  if (!content || !content.content) return content;
  return {
    ...content,
    content: content.content.map(obfuscateNode),
  };
}

/**
 * Creates a simple placeholder TiptapContent document with obfuscated text
 * of the given character count. Used for `card:typing-blur` events to show
 * visual feedback that content exists without revealing it.
 */
export function createPlaceholderContent(charCount: number): TiptapContent {
  if (charCount === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }
  const text = obfuscateText("x".repeat(charCount));
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}
