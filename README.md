# Game Night Library

A public, phone-friendly board game inventory for finding what fits the group. Filter by player
count, time, play style, accessibility needs, and house preferences—or let the weighted roulette
make the final choice.

[Open the library](https://bahbus.github.io/GameNightLibrary/) ·
[Browse the Wiki](https://github.com/Bahbus/GameNightLibrary/wiki) ·
[Documentation source](docs/README.md) ·
[Contribute](CONTRIBUTING.md)

![Game Night Library showing group filters and a matched shortlist](docs/images/library-overview.jpg)

_Example catalog data shown._

## What it does

- Keeps owned games and expansions in a portable, reviewable YAML inventory.
- Enriches the catalog with BoardGameGeek metadata during trusted GitHub Actions builds.
- Applies hard group requirements first, then ranks eligible games against softer preferences.
- Provides shareable filters and a transparent weighted roulette with no tracking or accounts.
- Keeps unowned games in a separate wish list so they never enter filters or roulette early.
- Turns guided Setup and maintenance requests into pull requests that a maintainer reviews manually.

The public site is static and hosted by GitHub Pages. Filtering, scoring, and roulette happen in
the browser; no personal profiles or named-player data are stored.

## Documentation

| Guide                                                                                                | Best for                                                          |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [Using the library](https://github.com/Bahbus/GameNightLibrary/wiki/Using-the-library)               | Visitors choosing a game or making a request                      |
| [Initial collection setup](https://github.com/Bahbus/GameNightLibrary/wiki/Initial-collection-setup) | Owners importing and reviewing a collection                       |
| [Maintaining the library](https://github.com/Bahbus/GameNightLibrary/wiki/Maintaining-the-library)   | Collaborators adding, editing, removing, or wish-listing games    |
| [Development](https://github.com/Bahbus/GameNightLibrary/wiki/Development)                           | Contributors running and testing the project locally              |
| [Architecture](https://github.com/Bahbus/GameNightLibrary/wiki/Architecture)                         | Maintainers understanding data flow and trust boundaries          |
| [Setup service](https://github.com/Bahbus/GameNightLibrary/wiki/Setup-service)                       | Administrators deploying collaborator verification and submission |
| [Repository policy](https://github.com/Bahbus/GameNightLibrary/wiki/Repository-policy)               | Administrators auditing GitHub protections and security settings  |

The [Wiki home](https://github.com/Bahbus/GameNightLibrary/wiki) groups these pages by audience
and workflow. Their [reviewable Markdown sources](docs/README.md) remain versioned with the code.

## Data and licensing

Inventory and shelf labels are public; never enter addresses, access instructions, contact details,
or other private information. Application code is MIT licensed. BoardGameGeek data, images, names,
and logos remain subject to their respective owners and terms; see [NOTICE.md](NOTICE.md).
