import { app, BrowserWindow } from 'electron';
function createWIndow()
{
    const mainWindow = new BrowserWindow(
        {
            width:1400,
            height:800,
            autoHideMenuBar:true,
            webPreferences:
            {
                nodeIntegration:true
            },
        })
        mainWindow.loadURL('http://localhost:5173')
}

app.whenReady().then(createWIndow)
app.on('window-all-closed',() =>
    {
        if(process.platform !== 'darwin') app.quit()
    })