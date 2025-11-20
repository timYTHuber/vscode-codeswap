const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({
  server,
  perMessageDeflate: false,
  clientTracking: true
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CodeSwap server running on port ${PORT}`);
});

const sessions = new Map(); // sessionId -> { player1: ws, player2: ws, codes: {p1: {code:'', language:''}, p2: {code:'', language:''}}, timer: interval }

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        // Remove from sessions if needed
        for (const [id, session] of sessions) {
            if (session.player1 === ws || session.player2 === ws) {
                if (session.timer) clearInterval(session.timer);
                sessions.delete(id);
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
    sessions.set(sessionId, { player1: ws, player2: null, codes: { p1: { code: '', language: '' }, p2: { code: '', language: '' } }, timer: null });
    ws.send(JSON.stringify({ type: 'sessionCreated', sessionId }));
    console.log(`Session ${sessionId} created`);
}

function joinSession(ws, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session not found' }));
        return;
    }
    if (session.player2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session full' }));
        return;
    }
    session.player2 = ws;
    ws.send(JSON.stringify({ type: 'sessionJoined', sessionId }));
    startTimer(sessionId);
    console.log(`Player joined session ${sessionId}`);
}

function startTimer(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    let timeLeft = 300;
    session.timer = setInterval(() => {
        timeLeft--;
        session.player1.send(JSON.stringify({ type: 'timerUpdate', timeLeft }));
        session.player2.send(JSON.stringify({ type: 'timerUpdate', timeLeft }));
        if (timeLeft <= 0) {
            performSwap(sessionId);
            timeLeft = 300;
        }
    }, 1000);
}

function handleSwap(ws, message) {
    const session = sessions.get(message.sessionId);
    if (!session) return;
    if (ws === session.player1) {
        session.codes.p1 = { code: message.code, language: message.language };
    } else if (ws === session.player2) {
        session.codes.p2 = { code: message.code, language: message.language };
    }
}

function performSwap(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return;
    // Swap codes
    const temp = session.codes.p1;
    session.codes.p1 = session.codes.p2;
    session.codes.p2 = temp;
    // Send to players
    session.player1.send(JSON.stringify({ type: 'swap', code: session.codes.p1.code, language: session.codes.p1.language }));
    session.player2.send(JSON.stringify({ type: 'swap', code: session.codes.p2.code, language: session.codes.p2.language }));
    console.log(`Swapped in session ${sessionId}`);
}