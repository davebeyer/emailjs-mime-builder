#!/bin/bash

rm -rf $PWD/dist
babel src --out-dir dist --ignore '**/*-unit.js' --source-maps inline

# DB: we do git operations intentionally
#
# git reset
# git add $PWD/dist
# git commit -m 'Updating dist files' -n
