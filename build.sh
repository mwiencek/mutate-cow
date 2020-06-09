#!/bin/bash

mkdir -p dist/orig

cp LICENSE README.md package.json dist/
cp main.js.flow dist/main.js.flow
cp main.js.flow dist/orig/

for js in *.js; do
  if [[ "$js" = "test.js" || "$js" = "bench.js" ]]; then
    continue
  fi
  ./node_modules/.bin/babel "$js" > "dist/$js"
  cp "$js" dist/orig/
done
