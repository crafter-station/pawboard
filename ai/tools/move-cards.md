Use this tool to move and arrange cards on the canvas.

## When to Use

- User asks to move, reposition, or arrange cards
- User wants to organize cards in a specific layout (vertical, horizontal, grid, etc.)
- User asks to group cards together at a location
- User wants to reorganize the board layout

## Parameters

- `cardIds`: Array of card IDs to move (required)
- `x`: Target X coordinate - center of the arrangement (required)
- `y`: Target Y coordinate - center of the arrangement (required)
- `layout`: Layout pattern for multiple cards (optional, default "grid"):
  - `"horizontal"`: Arrange in a single row (left to right)
  - `"vertical"`: Arrange in a single column (top to bottom)
  - `"grid"`: Arrange in a square/rectangular grid
  - `"diagonal"`: Arrange in a diagonal staircase pattern
  - `"circle"`: Arrange in a circular pattern

## Position Guidelines

The canvas uses a coordinate system where:
- (0, 0) is roughly the center of the initial view
- Positive X is right, negative X is left
- Positive Y is down, negative Y is up
- Cards are spaced ~250px horizontally, ~180px vertically

## Examples

<example>
User: "Arrange these cards vertically"
Use: moveCards with cardIds=[...], x=0, y=0, layout="vertical"
</example>

<example>
User: "Put all the cards in a row on the left"
Use: moveCards with cardIds=[...], x=-300, y=0, layout="horizontal"
</example>

<example>
User: "Organize cards in a circle"
Use: moveCards with cardIds=[...], x=0, y=0, layout="circle"
</example>

## Notes

- Users can only move cards they created (unless session permissions allow otherwise)
- The layout automatically spaces cards to prevent overlap
- Session must not be locked to move cards
- Use the canvas context to understand current card positions