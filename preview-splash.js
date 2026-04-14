const { app, BrowserWindow, screen } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().bounds
  const win = new BrowserWindow({
    width, height, x: 0, y: 0,
    frame: false, resizable: false, alwaysOnTop: true,
    backgroundColor: '#0a0a14',
    webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false },
  })
  const splashImg = path.join(__dirname, 'assets/splash.png').replace(/\\/g, '/')
  win.loadFile(path.join(__dirname, 'src/main/splash.html'), {
    query: { bg: 'file://' + splashImg }
  })
  setTimeout(() => app.quit(), 8500)
})
