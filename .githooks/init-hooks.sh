#!/bin/bash

if [[ "${IS_CODEBUILD:-false}" != 'true' ]] ; then
  cp .githooks/* .git/hooks/ && chmod +x .git/hooks/*
fi

exit 0