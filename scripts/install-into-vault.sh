#!/usr/bin/env bash
# Installs the cosmic CSS snippets and the two plugins into an EXISTING Obsidian vault.
#
#   scripts/install-into-vault.sh <path-to-vault> [--force]
#
# - Existing files are never overwritten unless --force is given.
# - appearance.json and community-plugins.json are backed up (name.json.bak-YYYYmmddHHMMSS) before any change,
#   and the new entries are merged in; nothing already enabled is removed.
# - Close Obsidian first (it rewrites its settings files on exit), then restart it afterwards.
# - Notes in the vault are never touched. Requires bash and python3 (used only to edit the JSON files safely).
set -euo pipefail

FORCE=0
VAULT=""
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) if [ -z "$VAULT" ]; then VAULT="$arg"; else echo "error: more than one path given" >&2; exit 2; fi ;;
  esac
done
[ -n "$VAULT" ] || { echo "usage: $0 <path-to-vault> [--force]" >&2; exit 2; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../vault/.obsidian" && pwd)"
[ -d "$VAULT" ] || { echo "error: '$VAULT' is not a directory" >&2; exit 1; }
VAULT="$(cd "$VAULT" && pwd)"
[ -d "$VAULT/.obsidian" ] || { echo "error: '$VAULT' has no .obsidian folder; open it once in Obsidian first" >&2; exit 1; }
[ "$VAULT/.obsidian" != "$SRC" ] || { echo "error: source and target are the same vault" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 is required to edit the JSON settings" >&2; exit 1; }

copied=0; skipped=0
copy_file() {  # copy_file <src> <dst>
  if [ -e "$2" ] && [ "$FORCE" -ne 1 ]; then
    echo "skip (exists): ${2#"$VAULT"/}"; skipped=$((skipped + 1))
  else
    mkdir -p "$(dirname "$2")"; cp "$1" "$2"
    echo "copy: ${2#"$VAULT"/}"; copied=$((copied + 1))
  fi
}

for f in "$SRC"/snippets/*.css; do
  copy_file "$f" "$VAULT/.obsidian/snippets/$(basename "$f")"
done

for d in "$SRC"/plugins/*/; do
  id="$(basename "$d")"
  for f in "$d"*; do copy_file "$f" "$VAULT/.obsidian/plugins/$id/$(basename "$f")"; done
done

# Merge the entries into the JSON settings; back up first, and abort untouched if a file is not valid JSON.
# The snippet order of the demo vault is kept, because later snippets override earlier ones.
python3 - "$VAULT/.obsidian" "$SRC" <<'PY'
import json, os, shutil, sys, time
base, src = sys.argv[1], sys.argv[2]
snippets = json.load(open(os.path.join(src, "appearance.json"), encoding="utf-8"))["enabledCssSnippets"]
plugins = json.load(open(os.path.join(src, "community-plugins.json"), encoding="utf-8"))
stamp = time.strftime("%Y%m%d%H%M%S")

def merge(name, default, update):
    path = os.path.join(base, name)
    data = default
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except ValueError:
            sys.exit("error: %s is not valid JSON; fix or remove it and run again (nothing was changed in it)" % name)
    before = json.dumps(data, sort_keys=True)
    data = update(data)
    if json.dumps(data, sort_keys=True) == before and os.path.exists(path):
        print("unchanged: .obsidian/" + name)
        return
    if os.path.exists(path):
        shutil.copy2(path, path + ".bak-" + stamp)
        print("backup: .obsidian/%s.bak-%s" % (name, stamp))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("updated: .obsidian/" + name)

def add_snippets(d):
    if not isinstance(d, dict): sys.exit("error: appearance.json must be a JSON object")
    cur = d.setdefault("enabledCssSnippets", [])
    d["enabledCssSnippets"] = cur + [s for s in snippets if s not in cur]
    return d

def add_plugins(d):
    if not isinstance(d, list): sys.exit("error: community-plugins.json must be a JSON array")
    return d + [p for p in plugins if p not in d]

merge("appearance.json", {}, add_snippets)
merge("community-plugins.json", [], add_plugins)
PY

echo
echo "Done: $copied file(s) copied, $skipped skipped."
echo "Next: start Obsidian, open Settings > Community plugins, turn off Restricted mode, and confirm"
echo "Neural System and Brain Signal are enabled. CSS snippets are enabled under Settings > Appearance."
