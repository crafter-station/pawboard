Use this tool to find cards similar to a given query or another card.

## When to Use

- User asks to find related or similar cards
- User wants to discover connections between ideas
- User asks "are there any cards about X?"
- User wants to find duplicates or overlapping ideas

## Parameters

- `query`: Text to search for similar cards (optional)
- `cardId`: ID of a card to find similar cards to (optional)
- `limit`: Maximum number of results, default 5 (optional)

You must provide either `query` or `cardId`, but not necessarily both.

## Examples

<example>
User: "Find cards related to user authentication"
Use: findSimilar with query="user authentication"
</example>

<example>
User: "Are there any cards similar to card xyz?"
Use: findSimilar with cardId="xyz"
</example>

<example>
User: "What ideas do we have about improving performance?"
Use: findSimilar with query="improving performance"
</example>

## Notes

- Uses AI embeddings to find semantic similarity (not just keyword matching)
- Returns cards sorted by similarity score
- Only returns cards with meaningful similarity (>30%)
- Cards need to have been edited at least once to have embeddings generated
