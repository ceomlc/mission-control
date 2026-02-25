#!/bin/bash
cd ~/projects/mission-control
git pull origin main
npm install
pkill -f "next" 2>/dev/null
npm run dev > /tmp/mc.log 2>&1 &
echo "Updated and restarted!"
