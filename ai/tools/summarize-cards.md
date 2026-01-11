Use this tool to generate a summary of cards on the board.

## When to Use

- User asks for an overview or summary of the ideas
- User wants to understand the main themes
- User asks "what do we have so far" or similar
- User wants a recap of the brainstorming session

## Parameters

- `cardIds`: Optional array of specific card IDs to summarize. If omitted, summarizes all cards in the session.

## Examples

<example>
User: "Summarize all the ideas on the board"
Use: summarizeCards with no parameters (summarizes all)
</example>

<example>
User: "What are the main themes from these three cards?"
Use: summarizeCards with cardIds=["id1", "id2", "id3"]
</example>

<example>
User: "Give me an overview of our brainstorming session"
Use: summarizeCards with no parameters
</example>

## Notes

- Only cards with content are included in the summary
- Empty cards are automatically filtered out
- The summary identifies themes, key ideas, and patterns
