import {_electron as electron,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const root=resolve('.test-data','fullscreen-launch-'+randomUUID());
const app=await electron.launch({args:['--user-data-dir='+root,resolve('desktop/main.cjs'),'--fullscreen'],env:{...process.env as Record<string,string>,NODE_BINARY:process.execPath,INFINITE_DATA_DIR:root+'/world',PORT:'0',ADMIN_PORT:'0'}});
try{const page=await app.firstWindow();await expect(page.frameLocator('#game').getByRole('button',{name:'Single player'})).toBeVisible({timeout:15000});await expect(page.locator('body')).toHaveClass(/fullscreen/);console.log(await app.evaluate(({BrowserWindow})=>({fullscreen:BrowserWindow.getAllWindows()[0].isFullScreen(),visible:BrowserWindow.getAllWindows()[0].isVisible(),title:BrowserWindow.getAllWindows()[0].getTitle()})));}finally{await app.close();}
