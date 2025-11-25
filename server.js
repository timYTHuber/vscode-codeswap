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

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

module.exports = server;

const sessions = new Map(); // sessionId -> { players: Map(ws, player), timer: number, interval: timeout }

function broadcastToSession(sessionId, message) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const messageStr = JSON.stringify(message);
    session.players.forEach(player => {
        if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(messageStr);
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
        case 'code_update':
            handleCodeUpdate(ws, message);
            break;
    }
}

function handleCodeUpdate(ws, message) {
    const session = findSessionByPlayer(ws);
    if (!session) return;
    const player = session.players.get(ws);
    if (player) {
        player.currentCode = message.code;
        player.currentLanguage = message.language;
    }
}

function createSession(ws) {
    const sessionId = Math.floor(1000 + Math.random() * 9000).toString();
    const player = { ws, currentCode: '', currentLanguage: '' };
    sessions.set(sessionId, {
        players: new Map([[ws, player]]),
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

    const player = { ws, currentCode: '', currentLanguage: '' };
    session.players.set(ws, player);
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


function performCodeSwap(sessionId) {
    const session = sessions.get(sessionId);
    if (!session || session.players.size !== 2) return;

    const players = Array.from(session.players.values());
    const [player1, player2] = players;

    // СОХРАНИТЬ текущие коды перед отправкой
    const player1Code = player1.currentCode || '';
    const player1Language = player1.currentLanguage || '';
    const player2Code = player2.currentCode || '';
    const player2Language = player2.currentLanguage || '';

    console.log(`Swapping codes: P1(${player1Language}) <-> P2(${player2Language})`);

    // ОТПРАВИТЬ код игрока 2 -> игроку 1
    if (player1.ws.readyState === WebSocket.OPEN) {
        player1.ws.send(JSON.stringify({
            type: 'code_swap',
            code: player2Code,
            language: player2Language,
            sender: 'player2'
        }));
    }

    // ОТПРАВИТЬ код игрока 1 -> игроку 2
    if (player2.ws.readyState === WebSocket.OPEN) {
        player2.ws.send(JSON.stringify({
            type: 'code_swap',
            code: player1Code,
            language: player1Language,
            sender: 'player1'
        }));
    }

    // ОБНОВИТЬ сохраненные коды после свопа
    player1.currentCode = player2Code;
    player1.currentLanguage = player2Language;
    player2.currentCode = player1Code;
    player2.currentLanguage = player1Language;
}

function findSessionByPlayer(ws) {
    for (const session of sessions.values()) {
        if (session.players.has(ws)) {
            return session;
        }
    }
    return null;
}