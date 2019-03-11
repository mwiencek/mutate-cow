#!/bin/bash

mkdir -p dist/orig

cp LICENSE README.md package.json dist/
cp index.mjs.flow dist/index.js.flow
cp index.mjs.flow dist/orig/

for mjs in *.mjs; do
  if [[ "$mjs" = "test.mjs" ]]; then
    continue
  fi
  js="dist/${mjs%.*}.js"
  ./node_modules/.bin/babel "$mjs" > "$js"
  sed -i '' 's/\.mjs//g' "$js"
  cp "$mjs" dist/orig/
done
