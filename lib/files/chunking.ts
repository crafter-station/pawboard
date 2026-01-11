/**
 * Text chunking utilities for file ingestion
 * Used to split documents into chunks for embedding and semantic search
 */

export interface ChunkOptions {
  maxChunkSize: number; // Maximum characters per chunk
  overlap: number; // Characters to overlap between chunks
  preserveMarkdown: boolean; // Try to preserve markdown structure
}

export interface TextChunk {
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 1000,
  overlap: 200,
  preserveMarkdown: true,
};

/**
 * Split text into chunks with configurable size and overlap
 */
export function chunkText(
  text: string,
  options: Partial<ChunkOptions> = {},
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxChunkSize, overlap, preserveMarkdown } = opts;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, "\n").trim();

  // If text is smaller than max chunk size, return as single chunk
  if (normalizedText.length <= maxChunkSize) {
    return [
      {
        content: normalizedText,
        index: 0,
        startOffset: 0,
        endOffset: normalizedText.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];

  if (preserveMarkdown) {
    // Try to split on semantic boundaries first
    const semanticChunks = splitOnSemanticBoundaries(normalizedText, opts);
    return semanticChunks;
  }

  // Simple character-based chunking with overlap
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < normalizedText.length) {
    const endPosition = Math.min(
      currentPosition + maxChunkSize,
      normalizedText.length,
    );

    // Try to find a good break point (newline or sentence end)
    let actualEnd = endPosition;
    if (endPosition < normalizedText.length) {
      actualEnd = findBreakPoint(normalizedText, currentPosition, endPosition);
    }

    const chunkContent = normalizedText
      .slice(currentPosition, actualEnd)
      .trim();

    if (chunkContent.length > 0) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex++,
        startOffset: currentPosition,
        endOffset: actualEnd,
      });
    }

    // Move position, accounting for overlap
    currentPosition = actualEnd - overlap;

    // Ensure we make progress
    if (currentPosition <= chunks[chunks.length - 1]?.startOffset) {
      currentPosition = actualEnd;
    }
  }

  return chunks;
}

/**
 * Split text on semantic boundaries (paragraphs, headers, etc.)
 * More intelligent chunking that preserves document structure
 */
function splitOnSemanticBoundaries(
  text: string,
  options: ChunkOptions,
): TextChunk[] {
  const { maxChunkSize, overlap } = options;
  const chunks: TextChunk[] = [];

  // Split on double newlines (paragraphs) first
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = "";
  let currentStartOffset = 0;
  let chunkIndex = 0;
  let textPosition = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    if (!paragraph) {
      textPosition += 2; // Account for the newlines
      continue;
    }

    // Check if adding this paragraph would exceed max size
    const newContent = currentChunk
      ? `${currentChunk}\n\n${paragraph}`
      : paragraph;

    if (newContent.length > maxChunkSize && currentChunk) {
      // Save current chunk and start new one
      chunks.push({
        content: currentChunk,
        index: chunkIndex++,
        startOffset: currentStartOffset,
        endOffset: textPosition,
      });

      // Start new chunk with overlap from previous
      if (overlap > 0 && currentChunk.length > overlap) {
        // Include end of previous chunk as context
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = `${overlapText}\n\n${paragraph}`;
      } else {
        currentChunk = paragraph;
      }
      currentStartOffset = textPosition;
    } else if (paragraph.length > maxChunkSize) {
      // Single paragraph is too large, split it further
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          index: chunkIndex++,
          startOffset: currentStartOffset,
          endOffset: textPosition,
        });
      }

      // Split large paragraph on sentences
      const subChunks = splitLargeParagraph(
        paragraph,
        maxChunkSize,
        overlap,
        textPosition,
        chunkIndex,
      );
      chunks.push(...subChunks);
      chunkIndex += subChunks.length;

      currentChunk = "";
      currentStartOffset = textPosition + paragraph.length;
    } else {
      currentChunk = newContent;
    }

    textPosition += paragraph.length + 2; // +2 for the double newline
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk,
      index: chunkIndex,
      startOffset: currentStartOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * Split a large paragraph into smaller chunks, trying to break on sentences
 */
function splitLargeParagraph(
  paragraph: string,
  maxSize: number,
  overlap: number,
  startOffset: number,
  startIndex: number,
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Try to split on sentences
  const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];

  let currentChunk = "";
  let chunkIndex = startIndex;
  let position = startOffset;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxSize && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunkIndex++,
        startOffset: position - currentChunk.length,
        endOffset: position,
      });

      // Add overlap
      if (overlap > 0) {
        const overlapText = currentChunk.slice(
          -Math.min(overlap, currentChunk.length),
        );
        currentChunk = overlapText + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += sentence;
    }
    position += sentence.length;
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      index: chunkIndex,
      startOffset: position - currentChunk.length,
      endOffset: position,
    });
  }

  return chunks;
}

/**
 * Find a good break point near the target position
 * Prefers: double newline > single newline > sentence end > space
 */
function findBreakPoint(text: string, start: number, target: number): number {
  // Look backwards from target for a good break point
  const searchRange = Math.min(200, target - start);
  const searchStart = target - searchRange;
  const searchText = text.slice(searchStart, target);

  // Try double newline first
  const doubleNewline = searchText.lastIndexOf("\n\n");
  if (doubleNewline !== -1) {
    return searchStart + doubleNewline + 2;
  }

  // Try single newline
  const singleNewline = searchText.lastIndexOf("\n");
  if (singleNewline !== -1) {
    return searchStart + singleNewline + 1;
  }

  // Try sentence end
  const sentenceEnd = searchText.search(/[.!?]\s+[A-Z]/);
  if (sentenceEnd !== -1) {
    return searchStart + sentenceEnd + 2;
  }

  // Fall back to space
  const space = searchText.lastIndexOf(" ");
  if (space !== -1) {
    return searchStart + space + 1;
  }

  // No good break point found, use target
  return target;
}

/**
 * Calculate statistics about chunks
 */
export function getChunkStats(chunks: TextChunk[]): {
  count: number;
  totalCharacters: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
} {
  if (chunks.length === 0) {
    return {
      count: 0,
      totalCharacters: 0,
      avgChunkSize: 0,
      minChunkSize: 0,
      maxChunkSize: 0,
    };
  }

  const sizes = chunks.map((c) => c.content.length);
  const totalCharacters = sizes.reduce((a, b) => a + b, 0);

  return {
    count: chunks.length,
    totalCharacters,
    avgChunkSize: Math.round(totalCharacters / chunks.length),
    minChunkSize: Math.min(...sizes),
    maxChunkSize: Math.max(...sizes),
  };
}
