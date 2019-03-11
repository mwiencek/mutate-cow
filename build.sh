#!/bin/bash

mkdir -p dist/orig

cp LICENSE README.md package.json dist/

for mjs in *.mjs; do
  if [[ "$mjs" = "test.mjs" ]]; then
    continue
  fi
  js="${mjs%.*}.js"
  ./node_modules/.bin/babel "$mjs" > "dist/$js"
  sed -i '' 's/\.mjs//g' "dist/$js"
  cp "$mjs" dist/orig/
done
