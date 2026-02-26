const LOADING_TIPS = [
  "Press Cmd+K (or Ctrl+K) to open the command menu and quickly access all board actions.",
  "Use the Blur feature to hide everyone's cards during brainstorming, then reveal them all at once!",
  "Lock your session from the command menu to prevent others from making changes.",
  "Press N to instantly add a new card wherever your cursor is.",
  "Use AI Clustering from the command menu to automatically group similar ideas together.",
  "Share your board by copying the URL. Anyone with the link can join and collaborate in real-time.",
  "Press C to drop a comment thread on the board for focused discussions.",
  "Your cursor is visible to everyone on the board in real-time, so you can point at things to guide the conversation.",
  "Claim your board by signing in to keep it forever. Unclaimed boards expire after 2 days.",
  "Use the chat drawer to have side conversations without cluttering the board.",
  "Board owners can clean up empty cards in bulk from the command menu.",
  "Drag cards around to spatially organize your ideas. Group related thoughts together!",
  "Switch between light and dark mode anytime using the command menu.",
  "Double-click anywhere on the board to quickly create a new card at that spot.",
  "You can rename yourself on any board. Open the command menu and select 'Change my name'.",
  "Board owners can rename the board from the command menu to give your session a clear title.",
  "Use the minimap in the corner to navigate large boards with lots of cards.",
  "Threads can be attached to cards for contextual discussions right where the idea lives.",
];

export function getRandomTip(): string {
  return LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
}
