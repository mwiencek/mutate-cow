#!/bin/bash

mkdir -p dist/orig

cp LICENSE README.md package.json dist/

for mjs in *.mjs; do
  if [[ "$mjs" = "test.mjs" ]]; then
    continue
  fi
  js="dist/${mjs%.*}.js"
  ./node_modules/.bin/babel "$mjs" > "$js"
  sed -i '' 's/\.mjs//g' "$js"
  sed -i '' '/@flow/d' "$js"
  echo '// @flow' | cat - "$js" > "$js.tmp"
  mv "$js.tmp" "$js"
  cp "$mjs" dist/orig/
done
