# Set up with an AI assistant

Give the prompt below to your AI coding assistant (Claude Code, Cursor, Copilot Chat, or similar). It installs the theme and plugins either as a fresh demo vault or into a vault you already use, without overwriting anything unless you say so.

## Copy-paste prompt

```text
You are installing the project in the current directory (an Obsidian vault layout, six CSS snippets
and two plugins, Neural System and Brain Signal).

Rules:
- Read README.md and AI_SETUP.md first.
- Ask me which option I want: (A) open the demo vault as a new vault, or (B) install the theme and
  plugins into a vault I already use. If B, ask me for the vault path. Never guess it.
- Never modify my notes. Use scripts/install-into-vault.sh without --force first and show me what
  was skipped. Use --force only if I explicitly agree to overwrite existing snippet or plugin files.
- Ask me to close Obsidian before running the installer.
- Show me the output of every command and stop if a step fails.

Do this:
1. Run the prerequisite checks (step 1 in AI_SETUP.md).
2. Run the syntax checks (step 2).
3. Perform option A or option B (step 3).
4. Walk me through the manual Obsidian steps (step 4) and the verification checklist (step 5).
5. Report PASS or FAIL for each check and mention the backup files the installer created.
```

## Checklist

### 1. Prerequisites

| Need | Check | Expected |
|---|---|---|
| Obsidian 1.5 or newer (desktop) | Obsidian > About | version 1.5.0 or higher |
| git | `git --version` | any recent version |
| bash and python3 (option B only) | `bash --version`, `python3 --version` | any recent version (macOS, Linux, WSL or Git Bash with Python) |
| Node.js (optional, only to run the syntax checks) | `node -v` | any recent LTS |

### 2. Verify the checkout (optional but quick)

```sh
node --check vault/.obsidian/plugins/neural-system/main.js
node --check vault/.obsidian/plugins/brain-signal/main.js
bash -n scripts/install-into-vault.sh
```

Expected: no output and exit code 0 for each command.

### 3a. Option A: open the demo vault

In Obsidian choose **Open folder as vault** and select the `vault/` folder of this repository. All snippets are already enabled in the vault settings and both plugins are listed as enabled.

### 3b. Option B: install into your existing vault

Close Obsidian first, then run (replace the path; the folder must already contain `.obsidian/`):

```sh
./scripts/install-into-vault.sh "/path/to/your-vault"
```

What it does:

- copies the 6 CSS snippets to `.obsidian/snippets/` and the plugins to `.obsidian/plugins/neural-system/` and `.obsidian/plugins/brain-signal/`;
- skips every file that already exists (add `--force` to overwrite them);
- backs up `appearance.json` and `community-plugins.json` as `*.bak-YYYYmmddHHMMSS` before changing them, then adds the snippet and plugin entries without removing anything already enabled;
- refuses to touch a settings file that is not valid JSON.

Expected output ends with `Done: N file(s) copied, M skipped.` Running it twice is safe: the second run prints `unchanged` for both JSON files.

To undo: restore the `.bak-*` files, then delete the 6 snippet files and the two plugin folders.

### 4. Manual steps in Obsidian

1. Start Obsidian and open the vault.
2. Settings > Community plugins > turn off **Restricted mode** (a one-time, vault-wide switch that only you can make).
3. Confirm **Neural System** and **Brain Signal** are enabled in the plugin list.
4. Settings > Appearance > CSS snippets: confirm `brain`, `cosmos`, `readability`, `cosmos-ui`, `cosmos-note`, `cosmos-area` are on (use the reload button next to the list if they are missing).

### 5. Verify

| Check | How | Expected |
|---|---|---|
| Neural System opens | Click the brain icon in the left ribbon, or run the command palette entry "Neural System: Open neural system" | A full-pane view showing the vault as a nervous system |
| Views switch | Press `1` to `9` inside the view | The view changes (body, brainstem, ring, and so on) |
| Brain Signal | Edit and save any note that has links, then open the graph view | A light signal travels along links of the changed note |
| Theme | Open the graph view and a note | Dark starry graph and the readable note style |
| Settings files | `python3 -c "import json;json.load(open('<vault>/.obsidian/appearance.json'))"` | no error |

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Plugins are not listed | Restricted mode is on, or Obsidian was running during install | Turn off Restricted mode, restart Obsidian, rerun the installer if needed |
| Snippets are listed but have no effect | Not enabled, or a different theme conflicts | Toggle them on under Appearance; try the default theme |
| Obsidian reverted the settings | It rewrote the files on exit after the installer ran | Close Obsidian, run the installer again, then start Obsidian |
| `error: '...' has no .obsidian folder` | The path is not an Obsidian vault | Open the folder once in Obsidian, or fix the path |
| `error: appearance.json is not valid JSON` | Hand-edited or corrupted settings | Fix the file or restore your backup, then rerun |
| `skip (exists)` for files you want updated | Existing files are protected | Rerun with `--force` (backups of the JSON files are still made) |
| Neural System is empty | Vault has very few notes | Open the demo vault (option A) to see the full effect |

### Uninstall and cleanup

1. Close Obsidian.
2. Disable the plugins and snippets in Settings, or restore the `appearance.json.bak-*` and `community-plugins.json.bak-*` files.
3. Delete `.obsidian/plugins/neural-system`, `.obsidian/plugins/brain-signal` and the 6 snippet files from `.obsidian/snippets/`.
4. If you used option A, delete the `vault/` folder or remove it from Obsidian's vault list.
