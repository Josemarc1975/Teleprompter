#!/data/data/com.termux/files/usr/bin/bash
# Instala e inicia o Controle TCL direto no celular Android (Termux).
# Uso: curl -fsSL https://raw.githubusercontent.com/Josemarc1975/Teleprompter/claude/app-controle-remoto-tv-tlc-9r1u7b/tcl-remote/termux-install.sh | bash
set -e
BRANCH="claude/app-controle-remoto-tv-tlc-9r1u7b"
DIR="$HOME/tcl-remote"

echo ">> Instalando Node.js..."
pkg update -y >/dev/null 2>&1 || true
pkg install -y nodejs curl tar

echo ">> Baixando o app..."
TMP="$(mktemp -d)"
curl -fsSL "https://codeload.github.com/Josemarc1975/Teleprompter/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$TMP"
mkdir -p "$DIR"
[ -f "$DIR/config.json" ] && cp "$DIR/config.json" "$TMP/config.keep"
cp -r "$TMP"/Teleprompter-*/tcl-remote/. "$DIR/"
[ -f "$TMP/config.keep" ] && cp "$TMP/config.keep" "$DIR/config.json"
rm -rf "$TMP"

cd "$DIR"
echo ">> Instalando dependências..."
npm install --omit=dev --no-audit --no-fund

# comando curto para as próximas vezes: digite  tv
mkdir -p "$HOME/.local/bin"
printf '#!/data/data/com.termux/files/usr/bin/bash\ntermux-wake-lock 2>/dev/null\ncd "$HOME/tcl-remote" && exec node server.js\n' > "$HOME/.local/bin/tv"
chmod +x "$HOME/.local/bin/tv"
grep -q '.local/bin' "$HOME/.bashrc" 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.local/bin:$PATH"

echo
echo "Pronto! Abra no navegador do celular: http://localhost:3000"
echo "Da próxima vez, abra o Termux e digite:  tv"
echo
exec tv
