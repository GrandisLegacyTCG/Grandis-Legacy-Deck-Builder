#!/usr/bin/env python3
from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = '/usr/bin/chromium'


def inline_page(style):
    if style == 1:
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        css=(ROOT/'css/app.css').read_text(encoding='utf-8')
        data=(ROOT/'js/data.js').read_text(encoding='utf-8')
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
    else:
        html=(ROOT/'style-2/index.html').read_text(encoding='utf-8')
        css=(ROOT/'style-2/css/app-v1.31.css').read_text(encoding='utf-8')
        data=(ROOT/'style-2/js/data.js').read_text(encoding='utf-8')
        app=(ROOT/'style-2/js/app-v1.31.js').read_text(encoding='utf-8')
    html=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',html,flags=re.I)
    html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>','',html,flags=re.I)
    html=html.replace('</head>',f'<style>{css}</style></head>')
    html=html.replace('</body>',f'<script>{data}</script><script>{app}</script></body>')
    return html


def metrics(page):
    btn=page.locator('.position-swap').first
    if btn.count()!=1:
        raise AssertionError('position-swap missing')
    return btn.evaluate('''e=>{const c=getComputedStyle(e),s=getComputedStyle(e.querySelector('svg'));return {
      width:c.width,height:c.height,borderRadius:c.borderRadius,borderColor:c.borderColor,
      backgroundColor:c.backgroundColor,boxShadow:c.boxShadow,display:c.display,
      svgWidth:s.width,svgHeight:s.height,stroke:s.stroke,strokeWidth:s.strokeWidth,
      linecap:s.strokeLinecap,linejoin:s.strokeLinejoin
    }}''')


def normalize(m):
    # display can differ flex/grid historically; the actual button geometry/art contract must match.
    return {k:v for k,v in m.items() if k!='display'}


def run(browser,width,height):
    pages=[]
    try:
        for style in (1,2):
            p=browser.new_page(viewport={'width':width,'height':height})
            p.set_content(inline_page(style),wait_until='domcontentloaded',timeout=20000)
            pages.append(p)
        a,b=metrics(pages[0]),metrics(pages[1])
        if normalize(a)!=normalize(b):
            raise AssertionError(f'Swap visual mismatch at {width}x{height}: Style1={a} Style2={b}')
    finally:
        for p in pages: p.close()


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox'])
        try:
            run(browser,1366,768)
            run(browser,1024,768)
        finally:
            browser.close()
    print('PASS v1.31 Style 1 / Style 2 Hero swap-button computed visual parity at desktop/tablet')

if __name__=='__main__': main()
