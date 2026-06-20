#!/bin/sh
# Пуш в GitHub без зависания на запросе credentials.
#
# Использование:
#   sh push.sh ["сообщение коммита"]
#
# Если передано сообщение — скрипт сначала добавит все изменения и закоммитит,
# затем запушит. Без сообщения — просто запушит уже сделанные коммиты.
#
# Токен берётся из файла .git-token (он в .gitignore, в репозиторий не попадает).

set -e

cd "$(dirname "$0")"

# --- читаем токен ---
if [ ! -f .git-token ]; then
    echo "Ошибка: нет файла .git-token. Положи в него GitHub Personal Access Token." >&2
    exit 1
fi
GH_TOKEN="$(tr -d ' \r\n' < .git-token)"
if [ -z "$GH_TOKEN" ]; then
    echo "Ошибка: файл .git-token пустой." >&2
    exit 1
fi

# --- параметры репозитория ---
GH_USER="fil1089"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# --- опциональный коммит ---
if [ -n "$1" ]; then
    git add -A
    git commit -m "$1"
fi

# --- временный askpass, чтобы git не лез в GUI ---
ASKPASS="$(mktemp)"
cat > "$ASKPASS" <<'EOF'
#!/bin/sh
case "$1" in
  Username*) echo "$GH_USER" ;;
  Password*) echo "$GH_TOKEN" ;;
esac
EOF
chmod +x "$ASKPASS"

cleanup() { rm -f "$ASKPASS"; }
trap cleanup EXIT

# --- пуш: отключаем credential.helper, отдаём токен через askpass ---
GH_USER="$GH_USER" GH_TOKEN="$GH_TOKEN" \
GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0 \
    git -c credential.helper= push origin "$BRANCH"

echo "Готово: ветка $BRANCH запушена в origin."
