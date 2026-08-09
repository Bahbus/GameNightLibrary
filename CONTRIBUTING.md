# Contributing

Start with [Maintaining the library](docs/MAINTAINING_THE_LIBRARY.md) for inventory workflows or
[Development](docs/DEVELOPMENT.md) for local setup, validation, generated-file boundaries, and
architecture links.

## Inventory requests

Use the Maintain screen in the site or one of the repository's inventory issue forms.
Maintainer requests may be turned into a pull request automatically. Public suggestions wait
for a maintainer to apply the `approved-inventory-change` label.

Do not include private addresses, personal contact information, access instructions, or
anything else that should not appear in a public repository.

## Code changes

Open a pull request against `main`. Before submitting:

```sh
npm run check
npm run test:e2e
```

Keep BGG-derived metadata out of commits. Add deterministic XML or catalog fixtures only when
they are necessary to test parsing and behavior.

## Inventory changes

- Keep slugs stable after publication.
- Use a BGG ID only once across base games and expansions.
- Nest expansions under an owned base game.
- Mark an expansion standalone only when it can be played independently.
- Prefer house overrides only when the physical copy or local experience differs materially
  from BGG's general metadata.
