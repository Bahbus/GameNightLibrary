# Using the library

Game Night Library helps a group narrow a collection without requiring a GitHub or BoardGameGeek
account. Browsing, filtering, sharing a shortlist, and using roulette all happen on the public site.

## Find games that fit

The Library separates constraints from preferences:

- **Hard requirements** remove games that cannot work tonight. These include group size, maximum
  duration, required play style, youngest player, table size, learned state, availability,
  accessibility conflicts, and excluded content.
- **Soft preferences** rank the games that remain. They can express a target duration or complexity,
  mood, theme, mechanics, interaction, luck, downtime, setup burden, teaching difficulty, and house
  rating.

Start with only the requirements the group truly needs. If the shortlist is too large, open
**Fine-tune the vibe** and add preferences. Search is also an active filter: it narrows both the
visible shortlist and Roulette's candidate pool, which can change the normalized odds. Clear the
search before opening Roulette when the title text should not constrain the draw.

Game modes and match scores are Game Night Library inferences based on BGG metadata and house
answers; they are not BGG ratings or recommendations. A maintainer can add a house override when an
inference does not describe the owned copy accurately.

## Share a group setup

**Copy link** stores the current filters and preferences in the URL. Anyone opening that link sees
the same group setup. The site also remembers the most recent settings in that browser, but it does
not store named people or send preference data to an analytics service.

## Use weighted roulette

Roulette draws from every eligible game. Stronger matches receive more weight, but every eligible
game keeps a chance of selection. The result is chosen before the animation starts.

After a draw:

- the result explains its strongest matches and any unmet soft preferences;
- rerolls temporarily exclude prior results until every currently eligible game has been drawn;
- after that pool is exhausted, Roulette resumes drawing from the full eligible pool;
- **Reset session** restores the full eligible pool;
- reduced-motion visitors receive the result immediately, and anyone can skip the animation.

## Browse the wish list

Wish-list games are not owned and never participate in Library filters or Roulette. Use **Request a
game** to enter a title, optional BGG or publisher link, and the reason it may fit. The site prepares
the request before handing the final submission to GitHub, where authentication and the public issue
record are handled.

## Suggest a library change

The **Manage** view explains the available add, edit, and remove paths. Forms collect the relevant
game and details, then open a prefilled GitHub request for confirmation. Public requests remain
suggestions until a maintainer approves them. Collaborator requests can be validated and converted
into a reviewable pull request, but they are never merged automatically.

See [Maintaining the library](MAINTAINING_THE_LIBRARY.md) for the complete maintainer workflow.

## Guided Setup

Setup collects private-to-the-household knowledge such as learned state, shelf label, setup burden,
house rating, moods, accessibility considerations, and content notes. The questionnaire is hidden
until the Setup service verifies that the signed-in GitHub user is a repository collaborator.

Progress saves automatically in that browser. Submission creates a branch and pull request for
review rather than changing the public inventory directly. When every required game is complete and
the Setup pull request is merged, the Setup tab disappears on the next deployment.

## Accessibility and privacy

- Current keyboard and screen-reader semantics are covered by automated Chromium and axe tests.
- Reduced motion, forced colors, enlarged text spacing, and 320-pixel layouts are exercised in CI.
- Cover failures fall back to local artwork; visitors do not hotlink BGG or GeekDo images.
- All inventory fields are public. Shelf values must be labels such as `Basement A3`, never an
  address, access instruction, phone number, or other sensitive detail.

Automated testing cannot replace every physical assistive-technology combination. Accessibility
problems are welcome through the repository's normal issue workflow.
