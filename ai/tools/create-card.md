Use this tool to create a new idea card on the board.

## When to Use

- User asks to add a new idea, note, or card
- User wants to capture a thought or brainstorm item
- User describes something they want to put on the board
- User asks you to create multiple cards (call this tool multiple times)

## Parameters

- `content`: The text content for the card (required)
- `color`: Hex color code (optional, e.g., "#fef08a" for yellow)
- `x`: X position on canvas (optional - if omitted, auto-finds a non-overlapping spot)
- `y`: Y position on canvas (optional - if omitted, auto-finds a non-overlapping spot)

## Positioning Strategy

When creating multiple cards:
1. **Without positions**: The tool auto-places cards to avoid overlap. Just omit x/y.
2. **With positions**: If you want specific arrangement, calculate positions using the canvas context:
   - Cards are ~224px wide, ~160px tall
   - Space horizontally: increment X by 250px
   - Space vertically: increment Y by 180px
   - Use canvas bounds to place cards near existing content

## Examples

<example>
User: "Add a card about improving user onboarding"
Use: createCard with content="Improve user onboarding experience"
(No position needed - auto-placement will handle it)
</example>

<example>
User: "Create 3 cards: Design, Development, Testing"
Call createCard 3 times. Either:
- Omit positions for auto-placement, OR
- Calculate positions for specific layout (e.g., vertical column)
</example>

## Notes

- Cards cannot be created if the session is locked
- If no color is specified, a random pleasant color is chosen
- Auto-placement prefers positions to the right of, then below, existing cards
