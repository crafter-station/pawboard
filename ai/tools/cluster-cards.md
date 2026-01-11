Use this tool to automatically organize cards by semantic similarity.

## When to Use

- User asks to organize or arrange cards by topic
- User wants to group similar ideas together
- User asks to cluster or categorize the board
- User wants to see patterns in the ideas

## Parameters

- `confirm`: Always true when called (just for confirmation flow)

## What It Does

1. Analyzes the content of all cards using AI embeddings
2. Groups cards by semantic similarity
3. Repositions cards so similar ones are near each other
4. Creates visual clusters on the canvas

## Examples

<example>
User: "Organize the cards by topic"
Use: clusterCards
</example>

<example>
User: "Group similar ideas together"
Use: clusterCards
</example>

<example>
User: "Can you arrange the board to show related ideas?"
Use: clusterCards
</example>

## Notes

- Only the session creator can cluster cards
- Session must not be locked
- Cards need content and embeddings (generated when cards are edited)
- Empty cards are ignored
- This will move all cards with embeddings - warn user before proceeding
