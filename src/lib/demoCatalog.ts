import type { CatalogGame } from "../types";

export const DEMO_GAMES: CatalogGame[] = [
  {
    slug: "demo-clockwork-cafe",
    name: "Clockwork Café",
    quantity: 1,
    shelf: "Demo shelf",
    availability: "available",
    learned: true,
    ownershipNotes: "Fictional example shown until the real collection is published.",
    house: {
      rating: 4,
      setupTimeRange: "under-5",
      teachDifficulty: 1,
      tableSpace: "compact",
      interaction: 3,
      luck: 2,
      downtime: 1,
      modes: ["competitive"],
      moods: ["cozy", "casual"],
      accessibilityFlags: [],
      contentFlags: [],
      recommendationNotes: "A quick, welcoming example for a small table."
    },
    expansions: [],
    metadata: {
      name: "Clockwork Café",
      minPlayers: 2,
      maxPlayers: 4,
      minMinutes: 20,
      maxMinutes: 35,
      minAge: 8,
      complexity: 1.4,
      categories: ["Fictional", "Food"],
      mechanics: ["Card Drafting", "Set Collection"],
      modes: ["competitive"],
      playerRecommendations: []
    }
  },
  {
    slug: "demo-moonbase-medics",
    name: "Moonbase Medics",
    quantity: 1,
    shelf: "Demo shelf",
    availability: "available",
    learned: true,
    ownershipNotes: "Fictional example shown until the real collection is published.",
    house: {
      rating: 5,
      setupTimeRange: "5-10",
      teachDifficulty: 3,
      tableSpace: "standard",
      interaction: 4,
      luck: 2,
      downtime: 2,
      modes: ["cooperative", "solo"],
      moods: ["strategic", "thematic"],
      accessibilityFlags: ["small-text"],
      contentFlags: [],
      recommendationNotes: "A cooperative example for groups that enjoy solving a shared puzzle."
    },
    expansions: [],
    metadata: {
      name: "Moonbase Medics",
      minPlayers: 1,
      maxPlayers: 5,
      minMinutes: 45,
      maxMinutes: 75,
      minAge: 12,
      complexity: 3.1,
      categories: ["Fictional", "Science Fiction"],
      mechanics: ["Cooperative Game", "Action Points"],
      modes: ["cooperative", "solo"],
      playerRecommendations: []
    }
  },
  {
    slug: "demo-goblin-grand-prix",
    name: "Goblin Grand Prix",
    quantity: 1,
    shelf: "Demo shelf",
    availability: "available",
    learned: true,
    ownershipNotes: "Fictional example shown until the real collection is published.",
    house: {
      rating: 3,
      setupTimeRange: "under-5",
      teachDifficulty: 1,
      tableSpace: "compact",
      interaction: 5,
      luck: 5,
      downtime: 1,
      modes: ["competitive", "team"],
      moods: ["silly", "chaotic", "social"],
      accessibilityFlags: ["color-dependent"],
      contentFlags: [],
      recommendationNotes: "A noisy team example for a larger group and a short time slot."
    },
    expansions: [],
    metadata: {
      name: "Goblin Grand Prix",
      minPlayers: 4,
      maxPlayers: 8,
      minMinutes: 15,
      maxMinutes: 30,
      minAge: 8,
      complexity: 1.2,
      categories: ["Fictional", "Racing"],
      mechanics: ["Dice Rolling", "Team-Based Game"],
      modes: ["competitive", "team"],
      playerRecommendations: []
    }
  },
  {
    slug: "demo-whispering-woods",
    name: "The Whispering Woods",
    quantity: 1,
    shelf: "Demo shelf",
    availability: "available",
    learned: false,
    ownershipNotes: "Fictional example shown until the real collection is published.",
    house: {
      rating: 4,
      setupTimeRange: "11-20",
      teachDifficulty: 4,
      tableSpace: "large",
      interaction: 3,
      luck: 1,
      downtime: 3,
      modes: ["cooperative"],
      moods: ["puzzly", "tense", "thematic"],
      accessibilityFlags: ["heavy-reading"],
      contentFlags: ["horror"],
      recommendationNotes: "A longer, more demanding example with content and accessibility tags."
    },
    expansions: [],
    metadata: {
      name: "The Whispering Woods",
      minPlayers: 2,
      maxPlayers: 4,
      minMinutes: 75,
      maxMinutes: 120,
      minAge: 14,
      complexity: 3.8,
      categories: ["Fictional", "Horror"],
      mechanics: ["Deduction", "Scenario-Based Campaign"],
      modes: ["cooperative"],
      playerRecommendations: []
    }
  }
];

export const DEMO_GAME_SLUGS = new Set(DEMO_GAMES.map((game) => game.slug));
