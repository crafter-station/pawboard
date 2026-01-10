/**
 * Clustering utilities for card content similarity
 *
 * Uses k-means clustering on embeddings to group similar cards,
 * then calculates non-overlapping positions for each cluster.
 */

export interface ClusterResult {
  clusters: Map<number, string[]>; // cluster index -> card IDs
  cardToCluster: Map<string, number>; // card ID -> cluster index
  centroids: number[][]; // cluster centroids
}

export interface CardPosition {
  id: string;
  x: number;
  y: number;
}

export interface LayoutConfig {
  cardWidth: number;
  cardHeight: number;
  intraClusterGap: number; // gap between cards in same cluster
  interClusterGap: number; // gap between clusters
  maxCardsPerRow: number; // max cards per row within a cluster
  startX: number; // starting X position
  startY: number; // starting Y position
}

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  cardWidth: 224,
  cardHeight: 220, // Increased to account for content, author, reactions
  intraClusterGap: 40, // Gap between cards in same cluster
  interClusterGap: 200, // Large gap between clusters to clearly separate groups
  maxCardsPerRow: 4,
  startX: 100,
  startY: 100,
};

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * Initialize centroids using k-means++ algorithm for better convergence
 */
function initializeCentroids(
  embeddings: Map<string, number[]>,
  k: number,
): number[][] {
  const points = Array.from(embeddings.values());
  const centroids: number[][] = [];

  // Choose first centroid randomly
  const firstIndex = Math.floor(Math.random() * points.length);
  centroids.push([...points[firstIndex]]);

  // Choose remaining centroids with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances: number[] = [];
    let totalDistance = 0;

    for (const point of points) {
      // Find minimum distance to any existing centroid
      let minDist = Number.POSITIVE_INFINITY;
      for (const centroid of centroids) {
        const dist = euclideanDistance(point, centroid);
        if (dist < minDist) minDist = dist;
      }
      distances.push(minDist * minDist); // Square the distance
      totalDistance += minDist * minDist;
    }

    // Choose next centroid with probability proportional to distance squared
    let random = Math.random() * totalDistance;
    for (let j = 0; j < points.length; j++) {
      random -= distances[j];
      if (random <= 0) {
        centroids.push([...points[j]]);
        break;
      }
    }

    // Fallback if we didn't select (shouldn't happen)
    if (centroids.length === i) {
      centroids.push([...points[Math.floor(Math.random() * points.length)]]);
    }
  }

  return centroids;
}

/**
 * Assign each point to the nearest centroid
 */
function assignToClusters(
  embeddings: Map<string, number[]>,
  centroids: number[][],
): Map<string, number> {
  const assignments = new Map<string, number>();

  for (const [id, embedding] of embeddings) {
    let minDist = Number.POSITIVE_INFINITY;
    let closestCluster = 0;

    for (let i = 0; i < centroids.length; i++) {
      const dist = euclideanDistance(embedding, centroids[i]);
      if (dist < minDist) {
        minDist = dist;
        closestCluster = i;
      }
    }

    assignments.set(id, closestCluster);
  }

  return assignments;
}

/**
 * Update centroids based on current assignments
 */
function updateCentroids(
  embeddings: Map<string, number[]>,
  assignments: Map<string, number>,
  k: number,
): number[][] {
  const dimensions = embeddings.values().next().value?.length || 0;
  const sums: number[][] = Array.from({ length: k }, () =>
    Array(dimensions).fill(0),
  );
  const counts: number[] = Array(k).fill(0);

  for (const [id, clusterIndex] of assignments) {
    const embedding = embeddings.get(id);
    if (embedding) {
      counts[clusterIndex]++;
      for (let i = 0; i < dimensions; i++) {
        sums[clusterIndex][i] += embedding[i];
      }
    }
  }

  return sums.map((sum, i) => {
    if (counts[i] === 0) return sum;
    return sum.map((val) => val / counts[i]);
  });
}

/**
 * Determine optimal number of clusters using silhouette score
 * Returns a value between 2 and maxK that maximizes clustering quality
 */
function findOptimalK(embeddings: Map<string, number[]>, maxK: number): number {
  const n = embeddings.size;
  if (n <= 2) return 1;
  if (n <= 4) return Math.min(2, n);

  const actualMaxK = Math.min(maxK, Math.floor(n / 2));
  let bestK = 2;
  let bestScore = -1;

  for (let k = 2; k <= actualMaxK; k++) {
    const result = kMeansClustering(embeddings, k, 10);
    const score = calculateSilhouetteScore(embeddings, result);

    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  return bestK;
}

/**
 * Calculate silhouette score for a clustering result
 * Higher is better (-1 to 1)
 */
function calculateSilhouetteScore(
  embeddings: Map<string, number[]>,
  result: ClusterResult,
): number {
  const ids = Array.from(embeddings.keys());
  if (ids.length <= 1) return 0;

  let totalScore = 0;

  for (const id of ids) {
    const embedding = embeddings.get(id)!;
    const myCluster = result.cardToCluster.get(id)!;
    const clusterMembers = result.clusters.get(myCluster) || [];

    // Calculate a: mean distance to same cluster
    let a = 0;
    const sameClusterMembers = clusterMembers.filter((mid) => mid !== id);
    if (sameClusterMembers.length > 0) {
      for (const memberId of sameClusterMembers) {
        a += euclideanDistance(embedding, embeddings.get(memberId)!);
      }
      a /= sameClusterMembers.length;
    }

    // Calculate b: minimum mean distance to other clusters
    let b = Number.POSITIVE_INFINITY;
    for (const [clusterIndex, members] of result.clusters) {
      if (clusterIndex === myCluster || members.length === 0) continue;

      let meanDist = 0;
      for (const memberId of members) {
        meanDist += euclideanDistance(embedding, embeddings.get(memberId)!);
      }
      meanDist /= members.length;

      if (meanDist < b) b = meanDist;
    }

    // Handle edge cases
    if (b === Number.POSITIVE_INFINITY) b = 0;
    if (sameClusterMembers.length === 0) {
      totalScore += 0;
    } else {
      const s = (b - a) / Math.max(a, b);
      totalScore += Number.isNaN(s) ? 0 : s;
    }
  }

  return totalScore / ids.length;
}

/**
 * K-means clustering algorithm
 *
 * @param embeddings - Map of card ID to embedding vector
 * @param k - Number of clusters (if undefined, will auto-detect optimal k)
 * @param maxIterations - Maximum iterations for convergence
 * @returns Clustering result with cluster assignments and centroids
 */
export function kMeansClustering(
  embeddings: Map<string, number[]>,
  k?: number,
  maxIterations = 50,
): ClusterResult {
  const n = embeddings.size;

  // Handle edge cases
  if (n === 0) {
    return {
      clusters: new Map(),
      cardToCluster: new Map(),
      centroids: [],
    };
  }

  if (n === 1) {
    const id = embeddings.keys().next().value!;
    return {
      clusters: new Map([[0, [id]]]),
      cardToCluster: new Map([[id, 0]]),
      centroids: [[...embeddings.values().next().value!]],
    };
  }

  // Auto-detect optimal k if not provided
  const actualK = k ?? findOptimalK(embeddings, Math.min(8, Math.ceil(n / 2)));

  // Ensure k doesn't exceed number of points
  const safeK = Math.min(actualK, n);

  // Initialize centroids using k-means++
  let centroids = initializeCentroids(embeddings, safeK);
  let assignments = assignToClusters(embeddings, centroids);

  // Iterate until convergence or max iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    const newCentroids = updateCentroids(embeddings, assignments, safeK);
    const newAssignments = assignToClusters(embeddings, newCentroids);

    // Check for convergence
    let changed = false;
    for (const [id, cluster] of newAssignments) {
      if (assignments.get(id) !== cluster) {
        changed = true;
        break;
      }
    }

    centroids = newCentroids;
    assignments = newAssignments;

    if (!changed) break;
  }

  // Build cluster map
  const clusters = new Map<number, string[]>();
  for (let i = 0; i < safeK; i++) {
    clusters.set(i, []);
  }
  for (const [id, clusterIndex] of assignments) {
    clusters.get(clusterIndex)!.push(id);
  }

  // Remove empty clusters
  for (const [index, members] of clusters) {
    if (members.length === 0) {
      clusters.delete(index);
    }
  }

  return {
    clusters,
    cardToCluster: assignments,
    centroids,
  };
}

/**
 * Calculate grid positions for cards within a cluster
 */
function layoutClusterGrid(
  cardIds: string[],
  startX: number,
  startY: number,
  config: LayoutConfig,
): CardPosition[] {
  const positions: CardPosition[] = [];
  const { cardWidth, cardHeight, intraClusterGap, maxCardsPerRow } = config;

  for (let i = 0; i < cardIds.length; i++) {
    const row = Math.floor(i / maxCardsPerRow);
    const col = i % maxCardsPerRow;

    positions.push({
      id: cardIds[i],
      x: startX + col * (cardWidth + intraClusterGap),
      y: startY + row * (cardHeight + intraClusterGap),
    });
  }

  return positions;
}

/**
 * Calculate cluster dimensions based on number of cards
 */
function getClusterDimensions(
  numCards: number,
  config: LayoutConfig,
): { width: number; height: number } {
  const { cardWidth, cardHeight, intraClusterGap, maxCardsPerRow } = config;

  const cols = Math.min(numCards, maxCardsPerRow);
  const rows = Math.ceil(numCards / maxCardsPerRow);

  return {
    width: cols * cardWidth + (cols - 1) * intraClusterGap,
    height: rows * cardHeight + (rows - 1) * intraClusterGap,
  };
}

/**
 * Calculate non-overlapping positions for all cards based on clustering result
 *
 * @param clusterResult - Result from k-means clustering
 * @param config - Layout configuration (optional)
 * @returns Array of card positions
 */
export function calculateClusterPositions(
  clusterResult: ClusterResult,
  config: Partial<LayoutConfig> = {},
): CardPosition[] {
  const finalConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const { interClusterGap, startX, startY } = finalConfig;

  const positions: CardPosition[] = [];
  const clusterIndices = Array.from(clusterResult.clusters.keys()).sort();
  const numClusters = clusterIndices.length;

  if (numClusters === 0) return positions;

  // Calculate cluster layout grid dimensions
  const clustersPerRow = Math.ceil(Math.sqrt(numClusters));

  // Calculate dimensions for each cluster to determine row heights
  const clusterDims = new Map<number, { width: number; height: number }>();
  for (const clusterIndex of clusterIndices) {
    const cardIds = clusterResult.clusters.get(clusterIndex) || [];
    clusterDims.set(
      clusterIndex,
      getClusterDimensions(cardIds.length, finalConfig),
    );
  }

  // Track current position
  let currentX = startX;
  let currentY = startY;
  let maxHeightInRow = 0;
  let clusterInRow = 0;

  for (const clusterIndex of clusterIndices) {
    const cardIds = clusterResult.clusters.get(clusterIndex) || [];
    if (cardIds.length === 0) continue;

    const dims = clusterDims.get(clusterIndex)!;

    // Check if we need to start a new row
    if (clusterInRow >= clustersPerRow) {
      currentX = startX;
      currentY += maxHeightInRow + interClusterGap;
      maxHeightInRow = 0;
      clusterInRow = 0;
    }

    // Layout cards within this cluster
    const clusterPositions = layoutClusterGrid(
      cardIds,
      currentX,
      currentY,
      finalConfig,
    );
    positions.push(...clusterPositions);

    // Update tracking
    currentX += dims.width + interClusterGap;
    maxHeightInRow = Math.max(maxHeightInRow, dims.height);
    clusterInRow++;
  }

  return positions;
}

/**
 * Main clustering function that combines embedding clustering with position calculation
 *
 * @param cardEmbeddings - Map of card ID to embedding vector
 * @param config - Optional layout configuration
 * @returns Object containing positions and cluster count
 */
export function clusterAndPosition(
  cardEmbeddings: Map<string, number[]>,
  config: Partial<LayoutConfig> = {},
): { positions: CardPosition[]; clusterCount: number } {
  if (cardEmbeddings.size === 0) {
    return { positions: [], clusterCount: 0 };
  }

  const clusterResult = kMeansClustering(cardEmbeddings);
  const positions = calculateClusterPositions(clusterResult, config);

  return {
    positions,
    clusterCount: clusterResult.clusters.size,
  };
}
