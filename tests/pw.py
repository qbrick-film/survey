# ブラウザでの総合テスト（CDNはローカルの lib/ に差し替え）
from playwright.sync_api import sync_playwright
import json, os
LIB='/home/claude/proj/lib'
spec=json.load(open('src/layout.json'))
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1000,'height':900},accept_downloads=True); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    def route(r):
        u=r.request.url
        m={'pdf.min.js':f'{LIB}/pdfjs/build/pdf.min.js','pdf.worker.min.js':f'{LIB}/pdfjs/build/pdf.worker.min.js','jszip.min.js':f'{LIB}/jszip/dist/jszip.min.js'}
        for k,v in m.items():
            if u.endswith('/'+k): return r.fulfill(path=v,content_type='application/javascript')
        r.abort()
    pg.route('https://**/*',route)
    pg.goto('file://'+os.path.abspath('dist/index.html')); pg.wait_for_timeout(800)
    pg.screenshot(path='tests/empty.png')
    pg.set_input_files('#file','tests/img/mix.pdf'); pg.wait_for_function("document.getElementById('status').textContent.includes('読み込みました')",timeout=60000)
    print(pg.inner_text('#status'))
    # 手動補正：マーク破損ページで四隅をクリック（吸着を試すため少しずらす）
    pg.set_viewport_size({'width':1000,'height':1600}); pg.click('.fail .fixBtn'); pg.wait_for_timeout(300); pg.query_selector('.fixer canvas').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    cv=pg.query_selector('.fixer canvas'); box=cv.bounding_box()
    for i,(x,y) in enumerate(spec['markers']):
        if i==2: pg.screenshot(path='tests/fixer.png')
        pg.mouse.click(box['x']+(x+1.2)/210*box['width'], box['y']+(y-1)/297*box['height']); pg.wait_for_timeout(100)
    pg.wait_for_timeout(500)
    print(pg.inner_text('#status'))
    rows=pg.evaluate("table().map(r=>r.join(','))")
    for r in rows: print(r)
    pg.click('#filter button[data-f="5"]'); pg.wait_for_timeout(200)
    print('filter5:',pg.inner_text('#filter'))
    with pg.expect_download() as d: pg.click('#csvBtn')
    print('csv',d.value.suggested_filename)
    with pg.expect_download() as d: pg.click('#zipBtn')
    print('zip',d.value.suggested_filename)
    pg.screenshot(path='tests/full.png',full_page=True)
    pg.set_viewport_size({'width':390,'height':800}); pg.wait_for_timeout(200)
    print('phone overflow:',pg.evaluate("document.documentElement.scrollWidth>innerWidth"))
    print('errors',errs); b.close()
