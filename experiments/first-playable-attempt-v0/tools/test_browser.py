from playwright.sync_api import sync_playwright
from pathlib import Path
import threading,http.server,socketserver,time
ROOT=Path(__file__).resolve().parents[1]
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
 def log_message(self,*args):pass
srv=socketserver.TCPServer(('127.0.0.1',0),Handler)
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1260,'height':1100},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{srv.server_address[1]}/',wait_until='networkidle')
 page.wait_for_function("document.getElementById('mode-label').textContent.includes('Town exploration')")
 page.screenshot(path='/mnt/data/SUBSTRATE-town-prototype-preview.png',full_page=True)
 print('Loaded town:',page.locator('#mode-label').inner_text())
 page.keyboard.down('ArrowDown');page.wait_for_timeout(1700);page.keyboard.up('ArrowDown')
 page.wait_for_timeout(550)
 print('After south gate:',page.locator('#mode-label').inner_text())
 assert 'Overworld' in page.locator('#mode-label').inner_text(),'South exit did not work'
 # Overworld spawn is 230,302; use up about 30px to get into town interaction area
 page.keyboard.down('ArrowUp');page.wait_for_timeout(220);page.keyboard.up('ArrowUp');page.keyboard.press('e');page.wait_for_timeout(600)
 print('After enter village:',page.locator('#mode-label').inner_text())
 assert 'Town exploration' in page.locator('#mode-label').inner_text(),'Return through entrance did not work'
 page.reload(wait_until='networkidle');page.wait_for_timeout(150)
 print('Reload persisted:',page.locator('#mode-label').inner_text())
 assert 'Town exploration' in page.locator('#mode-label').inner_text()
 print('Page JS errors:',errors)
 assert not errors
 browser.close()
srv.shutdown()
print('PASS: load, exit, reentry, persistence, browser errors')
