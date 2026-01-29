Use this tool to change the color of one or more cards.

## When to Use

- User asks to change card color(s)
- User wants to color-code or categorize cards visually
- User asks to make cards a specific color

## Parameters

- `cardIds`: Array of card IDs to change color (required)
- `color`: Color name or hex code (required)

## Available Color Names

- yellow (#fef08a)
- blue (#93c5fd)
- green (#86efac)
- pink (#f9a8d4)
- purple (#c4b5fd)
- orange (#fed7aa)
- red (#fca5a5)
- teal (#5eead4)
- cyan (#67e8f9)
- lime (#bef264)

You can also use hex codes directly (e.g., "#ff6b6b").

## Examples

<example>
User: "Make card abc123 blue"
Use: changeColor with cardIds=["abc123"], color="blue"
</example>

<example>
User: "Color all the urgent cards red"
Use: changeColor with cardIds=[array of urgent card IDs], color="red"
</example>

## Notes

- Users can only change colors of their own cards (unless permissions allow otherwise)
- Session must not be locked to change colors
