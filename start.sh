#!/bin/bash
echo ""
echo "🌦  Nigeria Drought Forecast Intelligence Platform"
echo "──────────────────────────────────────────────────"
echo ""

if ! command -v node &>/dev/null; then echo "❌ Node.js not found. Install from https://nodejs.org"; exit 1; fi

echo "📦 Installing server dependencies..."
cd server && npm install --silent && cd ..

echo "📦 Installing client dependencies..."
cd client && npm install --silent && cd ..

echo ""
echo "🚀 Starting Express API on http://localhost:5000 ..."
cd server && node index.js &
SERVER_PID=$!
cd ..

echo "🌐 Starting React + Vite on http://localhost:3000 ..."
cd client && npm run dev &
CLIENT_PID=$!
cd ..

echo ""
echo "✅ Platform starting up!"
echo "   Frontend  → http://localhost:3000"
echo "   Backend   → http://localhost:5000"
echo "   API docs  → http://localhost:5000/api/status"
echo ""
echo "   Optional — real model:"
echo "   cd ml && pip install -r requirements.txt"
echo "   ML_SERVICE_URL=http://localhost:8000 (restart server with this env var)"
echo "   uvicorn main:app --port 8000"
echo ""
echo "Press Ctrl+C to stop."
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; echo 'Stopped.'; exit 0" INT
wait
