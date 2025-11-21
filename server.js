const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CodeSwap Server OK');
    return;
  }
  res.writeHead(404);
  res.end();
});
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 CodeSwap Server running on port ${PORT}`);
});

const sessions = new Map(); // sessionId -> { players: Set, codes: Map, timer: number, interval: timeout }

function broadcastToSession(sessionId, message) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const messageStr = JSON.stringify(message);
    session.players.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(messageStr);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // Clean up sessions
        for (const [sessionId, session] of sessions) {
            if (session.players.has(ws)) {
                session.players.delete(ws);
                if (session.interval) {
                    clearInterval(session.interval);
                }
                // If session becomes empty, remove it
                if (session.players.size === 0) {
                    sessions.delete(sessionId);
                }
                break;
            }
        }
    });
});

function handleMessage(ws, message) {
    switch (message.type) {
        case 'createSession':
            createSession(ws);
            break;
        case 'joinSession':
            joinSession(ws, message.sessionId);
            break;
        case 'swap':
            handleSwap(ws, message);
            break;
    }
}

function createSession(ws) {
    const sessionId = Math.floor(1000 + Math.random() * 9000).toString();
    sessions.set(sessionId, {
        players: new Set([ws]),
        codes: new Map(),
        timer: null,
        interval: null
    });
    ws.send(JSON.stringify({ type: 'session_created', sessionId }));
    console.log(`Session ${sessionId} created, waiting for second player`);
}

function joinSession(ws, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
        return;
    }
    if (session.players.size >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session full' }));
        return;
    }

    session.players.add(ws);
    ws.send(JSON.stringify({ type: 'player_joined', sessionId }));

    // Start game when both players are connected
    if (session.players.size === 2) {
        startGameSession(sessionId);
    }

    console.log(`Player joined session ${sessionId}, players: ${session.players.size}`);
}

function startGameSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session || session.players.size !== 2) return;

    // Initialize codes map for both players
    session.codes.clear();
    session.players.forEach(ws => session.codes.set(ws, { code: '', language: '' }));

    // Start synchronized timer
    session.timer = 300; // 5 minutes
    broadcastToSession(sessionId, { type: 'game_start', timer: session.timer });

    session.interval = setInterval(() => {
        if (session.timer > 0) {
            session.timer--;

            // Send timer update to both players
            broadcastToSession(sessionId, { type: 'timer_update', timer: session.timer });

            // Warning at 30 seconds
            if (session.timer === 30) {
                broadcastToSession(sessionId, { type: 'swap_warning' });
            }

            // Perform swap at 0
            if (session.timer === 0) {
                performCodeSwap(sessionId);
                // Auto-restart timer for next round
                session.timer = 300;
            }
        }
    }, 1000);

    console.log(`Game started in session ${sessionId}`);
}

function handleSwap(ws, message) {
    const session = findSessionByPlayer(ws);
    if (!session) return;

    // Store the code for this player
    session.codes.set(ws, { code: message.code, language: message.language });
}

function performCodeSwap(sessionId) {
    const session = sessions.get(sessionId);
    if (!session || session.players.size !== 2) return;

    const players = Array.from(session.players);
    const player1 = players[0];
    const player2 = players[1];

    const code1 = session.codes.get(player1);
    const code2 = session.codes.get(player2);

    // Swap codes
    player1.send(JSON.stringify({ type: 'code_swap', code: code2.code, language: code2.language }));
    player2.send(JSON.stringify({ type: 'code_swap', code: code1.code, language: code1.language }));

    console.log(`Code swap performed in session ${sessionId}`);
}

function findSessionByPlayer(ws) {
    for (const session of sessions.values()) {
        if (session.players.has(ws)) {
            return session;
        }
    }
    return null;
}