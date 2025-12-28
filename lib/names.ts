const languages = [
  "Swift",
  "Rusty",
  "Pythonic",
  "Gopher",
  "Ruby",
  "Java",
  "Kotlin",
  "Scala",
  "Elixir",
  "Clojure",
  "Haskell",
  "Erlang",
  "Perl",
  "Lua",
  "Dart",
  "Zig",
  "Nim",
  "Crystal",
  "Julia",
  "TypeScript",
];

const animals = [
  "Fox",
  "Crab",
  "Penguin",
  "Gopher",
  "Gem",
  "Bean",
  "Robot",
  "Llama",
  "Phoenix",
  "Wizard",
  "Ninja",
  "Pirate",
  "Dragon",
  "Unicorn",
  "Panda",
  "Koala",
  "Otter",
  "Owl",
  "Wolf",
  "Tiger",
];

export function generateUsername(): string {
  const lang = languages[Math.floor(Math.random() * languages.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${lang} ${animal}`;
}

