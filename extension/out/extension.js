"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const ws_1 = require("ws");
let statusBarItem;
let ws = null;
let sessionId = null;
let timer = null;
let timeLeft = 300; // 5 minutes in seconds
function connectToServer() {
    const config = vscode.workspace.getConfiguration('codeswap');
    const serverUrl = config.get('serverUrl', 'ws://localhost:8080');
    ws = new ws_1.WebSocket(serverUrl);
    ws.on('open', () => {
        vscode.window.showInformationMessage('Connected to server');
    });
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        handleMessage(message);
    });
    ws.on('close', () => {
        vscode.window.showInformationMessage('Disconnected from server');
        resetTimer();
    });
    ws.on('error', (err) => {
        vscode.window.showErrorMessage(`WebSocket error: ${err.message}`);
    });
}
function handleMessage(message) {
    switch (message.type) {
        case 'sessionCreated':
            sessionId = message.sessionId;
            startTimer();
            break;
        case 'sessionJoined':
            sessionId = message.sessionId;
            startTimer();
            break;
        case 'swap':
            performSwap(message.code, message.language);
            resetTimer();
            startTimer();
            break;
        case 'timerUpdate':
            timeLeft = message.timeLeft;
            updateStatusBar();
            break;
    }
}
function startTimer() {
    timeLeft = 300;
    updateStatusBar();
    timer = setInterval(() => {
        timeLeft--;
        updateStatusBar();
        if (timeLeft === 30) {
            vscode.window.showWarningMessage('Swap in 30 seconds!');
        }
        if (timeLeft <= 0) {
            // Swap will be triggered by server
        }
    }, 1000);
}
function resetTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    timeLeft = 300;
    updateStatusBar();
}
function updateStatusBar() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    statusBarItem.text = `CodeSwap: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}
function performSwap(code, language) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        const currentCode = editor.document.getText();
        const currentLanguage = editor.document.languageId;
        // Send current code to server
        if (ws && sessionId) {
            ws.send(JSON.stringify({
                type: 'swap',
                sessionId,
                code: currentCode,
                language: currentLanguage
            }));
        }
        // Replace with received code
        const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
        editor.edit(editBuilder => {
            editBuilder.replace(fullRange, code);
        });
        vscode.window.showInformationMessage('Code swapped!');
    }
}
function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    updateStatusBar();
    statusBarItem.show();
    let createSession = vscode.commands.registerCommand('codeswap.createSession', () => {
        connectToServer();
        // Wait for connection, then send create
        setTimeout(() => {
            if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'createSession' }));
            }
        }, 1000);
    });
    let joinSession = vscode.commands.registerCommand('codeswap.joinSession', async () => {
        const id = await vscode.window.showInputBox({ prompt: 'Enter session ID' });
        if (id) {
            connectToServer();
            setTimeout(() => {
                if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'joinSession', sessionId: id }));
                }
            }, 1000);
        }
    });
    context.subscriptions.push(createSession, joinSession, statusBarItem);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map