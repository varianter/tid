#!/bin/sh
# Kills whatever process is listening on the given port (default: 3000).

port="${1:-3000}"
pids="$(lsof -ti :"$port")"

if [ -z "$pids" ]; then
  echo "Nothing listening on port $port"
  exit 0
fi

kill $pids
echo "Killed $(echo "$pids" | tr '\n' ' ')on port $port"
