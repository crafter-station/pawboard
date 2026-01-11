Use this tool to delete one or more cards from the board.

## When to Use

- User asks to remove, delete, or clear cards
- User wants to clean up unwanted ideas
- User asks to delete specific cards by ID or description

## Parameters

- `cardIds`: Array of card IDs to delete (required). Can be a single ID or multiple.

## Examples

<example>
User: "Delete card xyz789"
Use: deleteCards with cardIds=["xyz789"]
</example>

<example>
User: "Remove those three cards we just discussed"
Use: deleteCards with cardIds=["id1", "id2", "id3"]
</example>

## Notes

- Deletion is permanent and cannot be undone
- Users can only delete cards they created (unless they're the session creator)
- Session must not be locked to delete cards
- If some cards can't be deleted due to permissions, others will still be deleted
