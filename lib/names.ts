const adjectives = [
  "Fluffy",
  "Whiskers",
  "Purrfect",
  "Sleepy",
  "Curious",
  "Sneaky",
  "Cozy",
  "Fuzzy",
  "Chonky",
  "Sassy",
  "Zoomie",
  "Midnight",
  "Shadow",
  "Velvet",
  "Silky",
  "Ginger",
  "Marble",
  "Spotted",
  "Stripy",
  "Golden",
];

const catNames = [
  "Paws",
  "Meowster",
  "Whisker",
  "Mittens",
  "Tabby",
  "Calico",
  "Siamese",
  "Ragdoll",
  "Munchkin",
  "Bengal",
  "Sphinx",
  "Maine",
  "Persian",
  "Tuxedo",
  "Tortie",
  "Neko",
  "Kitty",
  "Furball",
  "Purrito",
  "Biscuit",
];

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const catName = catNames[Math.floor(Math.random() * catNames.length)];
  return `${adjective} ${catName}`;
}
