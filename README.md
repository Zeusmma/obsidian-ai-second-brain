# Obsidian AI Second Brain

**A ready-to-open Obsidian vault, a cosmic theme and two plugins that draw your notes as a living nervous system.**

[![test](https://github.com/Zeusmma/obsidian-ai-second-brain/actions/workflows/test.yml/badge.svg)](https://github.com/Zeusmma/obsidian-ai-second-brain/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![top language](https://img.shields.io/github/languages/top/Zeusmma/obsidian-ai-second-brain)
![last commit](https://img.shields.io/github/last-commit/Zeusmma/obsidian-ai-second-brain)
![repo size](https://img.shields.io/github/repo-size/Zeusmma/obsidian-ai-second-brain)

![Neural System: body, cortex map, constellation and 3D brain views](docs/hero.png)

- **Vault layout**: companion notes for an AI agent (identity, rules, open threads, last session, journal), a knowledge base split into lobes, projects, maps, templates and daily notes.
- **Cosmic theme**: six CSS snippets for a dark starry graph, readable notes and a calm interface.
- **Neural System plugin**: draws the vault as a human nervous system with many interactive views (body, cortex map, time river, sundial, synapse network, 3D brain and more).
- **Brain Signal plugin**: shows a light signal along graph links whenever a note changes.

All content in `vault/` is fictional demo data for a made-up user called Alex.

## Contents

- [At a glance](#at-a-glance)
- [Quick start](#quick-start)
- [Set up with an AI assistant](#set-up-with-an-ai-assistant)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Configuration and customization](#configuration-and-customization)
- [Optional AI memory layer](#optional-ai-memory-layer)
- [Folder structure](#folder-structure)
- [FAQ](#faq)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## At a glance

| | |
|---|---|
| Lines of code | JavaScript 1,586 · CSS 877 · JSON 166 · Shell 99 · YAML 26 (total 2,754) |
| Checks | CI runs `node --check` on both plugins, JSON validation and a dry install of the installer (`scripts/install-into-vault.sh`) |
| Platforms | Obsidian 1.5+ on macOS, Windows and Linux (desktop); installer script for macOS, Linux, WSL |
| Dependencies | 0 (the plugins are plain JavaScript; the installer needs bash and python3) |
| Demo vault | About 350 fictional notes and 1,400 links |
| Neural System views | 18 |
| CSS snippets | 6 |

## Quick start

```sh
git clone https://github.com/Zeusmma/obsidian-ai-second-brain.git && cd obsidian-ai-second-brain
# Option A: demo vault. In Obsidian: Open folder as vault -> select the vault/ folder
# Option B: add the theme and plugins to a vault you already use (close Obsidian first)
./scripts/install-into-vault.sh "/path/to/your-vault"
```

Then in Obsidian:

1. Open **Settings > Community plugins**, turn off Restricted mode and enable **Neural System** and **Brain Signal**.
2. Open **Settings > Appearance > CSS snippets** and enable all snippets (`brain`, `cosmos`, `readability`, `cosmos-ui`, `cosmos-note`, `cosmos-area`).
3. Open `🧠 Brain.md`, then the graph view. Click the brain icon in the ribbon to open the Neural System.

The installer never overwrites existing files unless you pass `--force`, backs up `appearance.json` and `community-plugins.json` before changing them, and is safe to run twice.

## Set up with an AI assistant

[`AI_SETUP.md`](AI_SETUP.md) has a copy-paste prompt and a numbered checklist for Claude Code, Cursor or any AI coding assistant: prerequisites, both install options, the manual Obsidian steps, verification, troubleshooting and uninstall. The assistant is told to ask for your vault path and never to touch your notes.

## Screenshots

![Neural System: body view](docs/screenshots/view-01-body.png)

*Neural System, body view: knowledge lobes in the brain, companion notes in the brainstem, daily notes and logs along the spine, skills and agents in the arms. The demo vault has about 350 fictional notes and 1,400 links.*

### All 18 Neural System views

Switch views with the toolbar or keys `1`–`9`, `0` and `Shift+1`–`Shift+8`.

| | | |
|---|---|---|
| **Body**<br>![Body](docs/screenshots/view-01-body.png) | **Brainstem**<br>![Brainstem](docs/screenshots/view-02-brainstem.png) | **Ring**<br>![Ring](docs/screenshots/view-03-ring.png) |
| **Matrix**<br>![Matrix](docs/screenshots/view-04-matrix.png) | **Heat body**<br>![Heat body](docs/screenshots/view-05-heat-body.png) | **Cortex map**<br>![Cortex map](docs/screenshots/view-06-cortex-map.png) |
| **Time river**<br>![Time river](docs/screenshots/view-07-time-river.png) | **Constellation map**<br>![Constellation map](docs/screenshots/view-08-constellation.png) | **Ego radial**<br>![Ego radial](docs/screenshots/view-09-ego-radial.png) |
| **Spinal section**<br>![Spinal section](docs/screenshots/view-10-spinal-section.png) | **Neuron**<br>![Neuron](docs/screenshots/view-11-neuron.png) | **Reflex arc**<br>![Reflex arc](docs/screenshots/view-12-reflex-arc.png) |
| **Synapse network**<br>![Synapse network](docs/screenshots/view-13-synapse-network.png) | **3D brain**<br>![3D brain](docs/screenshots/view-14-3d-brain.png) | **Dendrite tree**<br>![Dendrite tree](docs/screenshots/view-15-dendrite-tree.png) |
| **Sundial**<br>![Sundial](docs/screenshots/view-16-sundial.png) | **Wave**<br>![Wave](docs/screenshots/view-17-wave.png) | **Coral**<br>![Coral](docs/screenshots/view-18-coral.png) |

### Graph and notes

| Graph view (cosmic theme) | Note (readability snippet) |
|---|---|
| ![graph](docs/screenshots/graph.png) | ![note](docs/screenshots/note.png) |

## Architecture

```mermaid
flowchart LR
    V[Vault notes<br/>and links] --> NS[Neural System plugin<br/>18 views]
    V --> BS[Brain Signal plugin<br/>link signals]
    G[graph.json<br/>colour groups] --> NS
    CSS[6 CSS snippets] --> UI[Graph, notes, interface]
    C[Companion notes<br/>Core, Rules, Threads] --> A[AI agent<br/>AGENTS.md / CLAUDE.md]
```

The Neural System maps each knowledge lobe to a brain region, Companion notes to the brainstem, daily notes and logs to the spine, skills and agents to the arms, and loose notes to the legs. Colours come from the graph colour groups.

## Configuration and customization

- Rename lobes under `knowledge/` freely. The Neural System places each lobe on a brain region automatically.
- Colours come from `.obsidian/graph.json` colour groups. Edit them in the graph settings and the Neural System follows.
- Add `cssclasses: [brain-home]` to a note for the glowing home-page style, or `area-work`, `area-study`, `area-hobby`, `area-life` for a coloured banner.
- Callout types `decision`, `rule`, `question` and `source` have their own colours.
- Folder stripes in the file explorer are set at the end of `readability.css` by folder path. Change the paths to match your folders.
- The Neural System reads open threads from `🔮 Companion/Threads.md`. Add `DONE` or `CLOSED` to a thread title to close it.

## Optional AI memory layer

The vault is ready for any AI coding assistant that reads `AGENTS.md`. `AGENTS.md` and `CLAUDE.md` in the vault give a generic agent the same working rules: load the Companion notes at session start, write a session card, keep rules short, and save source-linked knowledge notes.

## Folder structure

```
vault/
  🧠 Brain.md          home note linking the main maps
  🔮 Companion/        Core, Rules, Threads, Last-Session, Journal (agent memory)
  🧭 Maps/             maps of content
  📋 Templates/        daily and note templates
  knowledge/           one folder (lobe) per topic, each with index.md
  projects/            one folder per project: README + Rules
  daily/               daily notes
  notes/               loose notes
  receipts/            session receipts (example)
  🧩 Skills/  🤖 Agents/  📜 Operations/   example folders for the Neural System arms and spine
  AGENTS.md  CLAUDE.md  instructions for an AI agent working in the vault
  .obsidian/           settings, CSS snippets, the two plugins
```

Repository root: `vault/` (the demo vault), `scripts/install-into-vault.sh`, `docs/` (screenshots), `AI_SETUP.md`.

## FAQ

**Does it change my notes?** No. The plugins read the vault and draw views. The installer only writes into `.obsidian/`.

**Does it need an AI agent?** No. The theme and plugins work on their own. `AGENTS.md` and `CLAUDE.md` only matter if you also use an AI agent in the vault.

**Mobile?** The manifests do not restrict the plugins to desktop, but they have only been tested on desktop.

**Will it conflict with my theme?** The snippets style the graph, notes and a few interface parts. Disable a snippet in Settings > Appearance if you do not want it.

**How do I remove it?** See the uninstall section of [AI_SETUP.md](AI_SETUP.md).

## Limitations

- Performance on very large vaults (many thousands of notes) has not been measured.
- The theme is tuned for Obsidian's default dark appearance (`theme: obsidian` in `appearance.json`).
- Folder stripes in the file explorer are hard-coded paths at the end of `readability.css`; edit them for your folders.

## Contributing

Issues and pull requests are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems as described in [SECURITY.md](SECURITY.md). Release notes are in [CHANGELOG.md](CHANGELOG.md).

## License

MIT, see [LICENSE](LICENSE).
