Use this tool to edit the content of an existing card.

## When to Use

- User asks to change, update, or modify a card's text
- User wants to correct or improve card content
- User asks to rewrite or rephrase a card

## Parameters

- `cardId`: The unique ID of the card to edit (required)
- `content`: The new text content for the card (required)

## Examples

<example>
User: "Change card abc123 to say 'Updated feature request'"
Use: editCard with cardId="abc123", content="Updated feature request"
</example>

<example>
User: "Fix the typo in that card"
Use: First identify the card ID, then editCard with the corrected content
</example>

## Notes

- You need the card ID to edit it - ask the user which card if unclear
- Only the card creator can edit their own cards (unless permissions allow otherwise)
- Session must not be locked to edit cards
