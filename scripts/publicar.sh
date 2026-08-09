#!/usr/bin/env bash
#
# Publica @nyro-ai/ui en GitHub Packages a mano.
#
#   ./scripts/publicar.sh --dry-run   comprueba todo y NO publica
#   ./scripts/publicar.sh             comprueba todo y publica
#
# La vía normal es empujar un tag `v*` y dejar que .github/workflows/publish.yml
# haga el trabajo, que además no necesita PAT: le basta el GITHUB_TOKEN del
# propio repo con `permissions: packages: write`. Este script es para cuando esa
# vía no está disponible — hoy, porque Actions no arranca en la org — y lleva
# los mismos guardarraíles que el workflow para que publicar a mano no salga
# más barato en comprobaciones que publicar automático.
#
# Necesita un PAT con write:packages + repo (el repo es privado):
#   https://github.com/settings/tokens/new?scopes=write:packages,repo
# Se pide por teclado, no se muestra, no queda en el historial del shell y vive
# en un archivo temporal con permisos 600 que se borra al salir, falle o no.
#
# Ojo con el scope: write:packages publica. Las apps que INSTALEN el paquete
# necesitan read:packages, que es un permiso distinto.

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PAQUETE="@nyro-ai/ui"
REGISTRO="https://npm.pkg.github.com"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

fallo() { echo "  ✗ $*" >&2; exit 1; }
ok()    { echo "  ✓ $*"; }

echo "== Comprobaciones previas =="

# 1. El árbol tiene que estar limpio: si no, publicas algo que no está en git
#    y después no hay forma de saber qué se publicó exactamente.
[ -z "$(git status --porcelain)" ] || fallo "Hay cambios sin commitear. Commitea o descarta antes de publicar."
ok "Árbol limpio"

VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"

# 2. El tag tiene que existir y apuntar a HEAD.
#    publish.yml compara el NOMBRE del tag con la versión del package.json.
#    Aquí comparamos además el COMMIT, que es el hueco que el workflow no ve:
#    un tag movido o retrasado publica contenido que no es el que el tag
#    describe, y eso ya pasó una vez en este repo.
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || fallo "No existe el tag $TAG. Créalo con: git tag -a $TAG -m '$TAG'"
TAG_SHA="$(git rev-parse "$TAG^{}")"
HEAD_SHA="$(git rev-parse HEAD)"
[ "$TAG_SHA" = "$HEAD_SHA" ] || fallo "El tag $TAG apunta a ${TAG_SHA:0:7} y HEAD es ${HEAD_SHA:0:7}. Publicarías contenido distinto del que el tag describe."
ok "$TAG apunta a HEAD (${HEAD_SHA:0:7})"

# 3. Tag y rama empujados, o el paquete publicado referenciará un commit que
#    nadie más puede ver.
REMOTO_TAG="$(git ls-remote origin "refs/tags/$TAG^{}" | cut -f1)"
[ "$REMOTO_TAG" = "$TAG_SHA" ] || fallo "El tag $TAG en origin apunta a ${REMOTO_TAG:0:7} (o no está). Empújalo antes de publicar."
REMOTO_MAIN="$(git ls-remote origin refs/heads/main | cut -f1)"
[ "$REMOTO_MAIN" = "$HEAD_SHA" ] || fallo "origin/main está en ${REMOTO_MAIN:0:7} y HEAD en ${HEAD_SHA:0:7}. Empuja main primero."
ok "Tag y main empujados a origin"

# 4. Build limpio desde cero: nunca publiques un dist/ heredado de otra rama.
echo "== Build limpio =="
rm -rf dist
npm run typecheck
npm run build
ok "typecheck y build"

# 5. El mismo guardarraíl del tarball que ci.yml. La lista `files` del
#    package.json es fácil de dejar desactualizada, y el síntoma aparecería en
#    la app que lo instala, no aquí.
echo "== Contenido del paquete =="
npm pack --silent >/dev/null
TGZ="$(ls -1 ./*.tgz | head -1)"
trap 'rm -f "$TGZ"' EXIT
for f in package/tokens.css package/preset.js package/dist/index.js package/dist/index.d.ts; do
  tar -tzf "$TGZ" | grep -qx "$f" || fallo "Falta $f en el tarball. Revisa la lista \`files\` del package.json."
done
ok "Los cuatro puntos de entrada están ($(tar -tzf "$TGZ" | wc -l | tr -d ' ') archivos)"

# 6. El token, al final: si algo iba a fallar, que falle antes de pedirlo.
echo
echo "PAT de GitHub con write:packages + repo."
echo "No se muestra al escribir y no queda en el historial."
printf "Token: "
read -rs NYRO_PAT || true
echo
[ -n "${NYRO_PAT:-}" ] || fallo "Token vacío. Ejecuta el script en una terminal interactiva."

NPMRC="$(mktemp -t nyro-npmrc)"
chmod 600 "$NPMRC"
trap 'rm -f "$NPMRC" "$TGZ"' EXIT
cat > "$NPMRC" <<EOF
@nyro-ai:registry=$REGISTRO
//npm.pkg.github.com/:_authToken=$NYRO_PAT
EOF
unset NYRO_PAT

# 7. Que la versión no exista ya. npm publish fallaría igual, pero con un error
#    de registro genérico; este dice qué hacer.
echo "== Registro =="
if npm view "$PAQUETE@$VERSION" version --userconfig "$NPMRC" >/dev/null 2>&1; then
  fallo "$PAQUETE@$VERSION ya existe. Sube la versión con 'npm version patch|minor|major'."
fi
ok "La versión $VERSION está libre"

if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "== --dry-run: todo comprobado, no se publicó nada =="
  npm publish --dry-run --userconfig "$NPMRC"
  exit 0
fi

echo "== Publicando $PAQUETE@$VERSION =="
npm publish --userconfig "$NPMRC"

echo
echo "Publicado $PAQUETE@$VERSION"
echo
echo "Las apps que lo instalen necesitan NODE_AUTH_TOKEN con read:packages"
echo "(scope DISTINTO de write:packages). El .npmrc ya está commiteado en los"
echo "dos repos de ERP."
echo
echo "  npm install $PAQUETE@$VERSION"
