"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const ws_1 = require("ws");
let statusBarItem;
let ws = null;
let sessionId = null;
let timeLeft = 300; // 5 minutes in seconds
let isConnected = false;
async function applyCodeToEditor(code, language) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found for code swap');
        return;
    }
    // СОХРАНИТЬ текущий код перед заменой
    await saveCurrentCode();
    // ЗАМЕНИТЬ весь текст в редакторе
    const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
    await editor.edit(editBuilder => {
        editBuilder.replace(fullRange, code);
    });
    vscode.window.showInformationMessage(`✅ Received ${language} code from partner`);
}
async function saveCurrentCode() {
    const editor = vscode.window.activeTextEditor;
    if (editor && isConnected) {
        const code = editor.document.getText();
        const language = editor.document.languageId;
        // ОТПРАВИТЬ серверу текущий код
        if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'code_update',
                code: code,
                language: language
            }));
        }
    }
}
function setupEditorListener() {
    vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
            saveCurrentCode();
        }
    });
}
function connectToServer() {
    const config = vscode.workspace.getConfiguration('codeswap');
    const serverUrl = config.get('serverUrl', 'ws://localhost:8080');
    ws = new ws_1.WebSocket(serverUrl);
    ws.on('open', () => {
        isConnected = true;
        vscode.window.showInformationMessage('Connected to server');
    });
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        handleMessage(message);
    });
    ws.on('close', () => {
        isConnected = false;
        vscode.window.showInformationMessage('Disconnected from server');
        timeLeft = 300;
        updateStatusBar();
    });
    ws.on('error', (err) => {
        vscode.window.showErrorMessage(`WebSocket error: ${err.message}`);
    });
}
async function handleMessage(message) {
    switch (message.type) {
        case 'session_created':
            sessionId = message.sessionId;
            vscode.window.showInformationMessage(`Session created: ${sessionId}. Waiting for second player...`);
            updateStatusBar();
            break;
        case 'player_joined':
            sessionId = message.sessionId;
            vscode.window.showInformationMessage('Second player joined! Game starting...');
            break;
        case 'game_start':
            timeLeft = message.timer;
            vscode.window.showInformationMessage('Game started! CodeSwap timer: 5:00');
            updateStatusBar();
            break;
        case 'timer_update':
            timeLeft = message.timer;
            updateStatusBar();
            break;
        case 'swap_warning':
            vscode.window.showWarningMessage('⚠️ Code swap in 30 seconds!');
            break;
        case 'code_swap':
            await applyCodeToEditor(message.code, message.language);
            vscode.window.showInformationMessage(`🔄 Code swapped with ${message.sender}!`);
            break;
        case 'error':
            vscode.window.showErrorMessage(`Error: ${message.message}`);
            break;
    }
}
function updateStatusBar() {
    if (!sessionId) {
        statusBarItem.text = 'CodeSwap: Not connected';
    }
    else if (timeLeft === 300 && !ws) {
        statusBarItem.text = 'CodeSwap: Waiting for players...';
    }
    else {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        statusBarItem.text = `CodeSwap: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}
function activate(context) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    updateStatusBar();
    statusBarItem.show();
    setupEditorListener();
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