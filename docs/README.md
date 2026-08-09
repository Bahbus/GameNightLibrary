# Game Night Library documentation

These guides keep operational detail out of the project landing page while preserving it alongside
the code it describes. Repository-native documentation is reviewed in pull requests, validated by
the test suite, and versioned with application changes.

## Choose a guide

| I want to…                                    | Start here                                              |
| --------------------------------------------- | ------------------------------------------------------- |
| Find a game for tonight                       | [Using the library](USING_THE_LIBRARY.md)               |
| Understand filters, match scores, or roulette | [Using the library](USING_THE_LIBRARY.md)               |
| Import the initial owned collection           | [Initial collection setup](INITIAL_COLLECTION_SETUP.md) |
| Complete or troubleshoot guided Setup         | [Initial collection setup](INITIAL_COLLECTION_SETUP.md) |
| Add, edit, remove, or request a game          | [Maintaining the library](MAINTAINING_THE_LIBRARY.md)   |
| Run the app or tests locally                  | [Development](DEVELOPMENT.md)                           |
| Understand components and trust boundaries    | [Architecture](ARCHITECTURE.md)                         |
| Deploy the verification/submission backend    | [Setup service](SETUP_SERVICE.md)                       |
| Audit or apply GitHub protections             | [Repository policy](REPOSITORY_POLICY.md)               |
| Report a security problem                     | [Security policy](../SECURITY.md)                       |

## Core records

- `data/inventory.yaml` is the canonical ownership record.
- `data/wishlist.yaml` contains unowned games under consideration.
- `data/inventory.matching.csv` records reviewed identity and expansion relationships during initial
  migration.
- `data/inventory.house.csv` records owner-supplied shelf and house-experience answers.
- BGG metadata and cached thumbnails exist only in generated build artifacts; they are not committed.

All formats above are open, UTF-8 text formats. Generated JSON, reports, browser-test output, and
build directories are intentionally ignored.

## Documentation maintenance

Update the guide that owns a workflow whenever behavior changes. Keep README.md focused on product
orientation and links. Relative Markdown links and image targets are checked by the unit suite so a
renamed guide cannot silently leave broken navigation.
