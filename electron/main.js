import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For simplicity in this existing project, though security-wise contextIsolation: true is better. 
            // Given it uses media pipe, it's mostly frontend. 
            // I'll stick to defaults if possible, but let's enable nodeIntegration: true to be safe if they need local access later, or strict default if not.
            // Actually, standard Vite app doesn't need nodeIntegration.
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Check if we are in dev mode (you can pass a flag or check env)
    // For simplicity, we'll try to connect to localhost first, or fallback to file?
    // Easier: defined strictly by script.

    // Check if we are in dev mode
    if (process.argv.includes('--dev')) {
        win.loadURL('http://localhost:5173');
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
