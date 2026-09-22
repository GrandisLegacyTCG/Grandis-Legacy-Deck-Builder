#!/usr/bin/env python3
from pathlib import Path
import json
import re
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = '/usr/bin/chromium'


def inline_page(style: int) -> str:
    if style == 1:
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        data = (ROOT / 'js/data.js').read_text(encoding='utf-8')
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
    else:
        html = (ROOT / 'style-2/index.html').read_text(encoding='utf-8')
        css = (ROOT / 'style-2/css/app-v1.31.css').read_text(encoding='utf-8')
        data = (ROOT / 'style-2/js/data.js').read_text(encoding='utf-8')
        app = (ROOT / 'style-2/js/app-v1.31.js').read_text(encoding='utf-8')
    html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html, flags=re.I)
    html = re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*>', '', html, flags=re.I)
    html = html.replace('</head>', f'<style>{css}</style></head>')
    html = html.replace('</body>', f'<script>{data}</script><script>{app}</script></body>')
    return html


def intersects(a, b):
    return not (a['x'] + a['width'] <= b['x'] or b['x'] + b['width'] <= a['x'] or a['y'] + a['height'] <= b['y'] or b['y'] + b['height'] <= a['y'])


def require(ok, message):
    if not ok:
        raise AssertionError(message)


def preview_visible(page):
    return page.locator('#hoverCardZoom').is_visible()


def run_style1(browser):
    page = browser.new_page(viewport={'width': 1440, 'height': 1200})
    page.set_default_timeout(10000)
    page.set_content(inline_page(1), wait_until='domcontentloaded', timeout=20000)
    require(page.locator('[data-starter-index]').count() == 5, 'Style 1 must expose exactly five OSA v1.9.1 starters')
    page.locator('[data-starter-index]').first.click()
    require(not page.locator('#newDeckDialog').is_visible(), 'Style 1 starter dialog did not close')
    page.locator('[data-section-toggle="main"]').click()
    rows = page.locator('.main-deck-row')
    require(rows.count() >= 6, 'Style 1 starter did not populate enough deck rows')
    preview = page.locator('#hoverCardZoom')
    tested = 0
    # Test several rows with enough vertical room to prove original per-row ABOVE placement.
    for idx in range(rows.count()):
        row = rows.nth(idx)
        row.scroll_into_view_if_needed()
        rb = row.bounding_box()
        if not rb or rb['y'] < 380 or rb['y'] > 1080:
            continue
        row.hover()
        require(preview_visible(page), f'Style 1 preview missing on row {idx}')
        pb = preview.bounding_box(); require(pb, 'Style 1 preview geometry unavailable')
        center_x = pb['x'] + pb['width']/2
        require(abs(center_x - rb['x']) <= 3, f'Style 1 preview center X is not anchored to hovered row left edge ({idx})')
        require(pb['y'] + pb['height'] <= rb['y'] - 5, f'Style 1 preview is not above hovered row {idx}')
        require(abs(pb['width']-250) < 1 and abs(pb['height']-350) < 1, 'Style 1 approved preview size changed')
        require(preview.evaluate('e=>getComputedStyle(e).pointerEvents') == 'none', 'Style 1 preview captures pointer events')
        controls = row.locator('.qty-control')
        for i in range(controls.count()):
            cb = controls.nth(i).bounding_box()
            require(cb and not intersects(pb, cb), f'Style 1 preview overlaps +/- control on row {idx}')
        # Direct source mouseleave toward preview must hide immediately.
        page.mouse.move(pb['x'] + pb['width']/2, pb['y'] + pb['height']/2)
        require(preview.is_hidden(), f'Style 1 preview did not hide on source mouseleave row {idx}')
        tested += 1
        if tested >= 3:
            break
    require(tested >= 2, 'Style 1 could not verify multiple row-relative vertical anchors')

    # +/- remains usable after preview behavior.
    row = page.locator('.main-deck-row:has(button[data-add-main]:not([disabled]))').first
    row.scroll_into_view_if_needed(); row.hover()
    card_id = row.get_attribute('data-main-deck-id')
    before = int(row.locator('.main-qty').text_content())
    row.locator('[data-add-main]').click()
    # Reacquire the same card after rerender. The old selector can move to a different row
    # when this click reaches that card's copy limit.
    row2 = page.locator(f'[data-main-deck-id="{card_id}"]')
    after = int(row2.locator('.main-qty').text_content())
    require(after == before + 1, 'Style 1 + control regressed')
    page.close()
    return (250,350)


def same_row_pairs(boxes, direction='right'):
    pairs=[]
    for i,a in boxes:
        for j,b in boxes:
            if i==j: continue
            ay=a['y']+a['height']/2; by=b['y']+b['height']/2
            if abs(ay-by) > min(a['height'],b['height'])*0.35: continue
            if direction=='right' and b['x'] > a['x']:
                pairs.append((b['x']-a['x'],i,j))
            if direction=='left' and b['x'] < a['x']:
                pairs.append((a['x']-b['x'],i,j))
    return sorted(pairs)


def verify_all_starters_application(page):
    # Exactly five active starters at actual application data + UI layer.
    require(page.evaluate('window.GL_DECK_BUILDER_DATA.starters.length') == 5, 'Style 2 application data is not exactly five starters')
    require(page.locator('#loadStarter').count()==1, 'Style 2 Load Starter control missing')
    exported=[]
    for idx in range(5):
        # Clear to avoid replacement confirmation complexity.
        if page.locator('#deckCount').text_content().strip() != '0':
            page.locator('#clearDeck').click()
            if page.locator('#confirmDialog').is_visible(): page.locator('#confirmOk').click()
        page.locator('#loadStarter').click()
        require(page.locator('#starterDialog').is_visible(), f'Style 2 starter dialog did not open for starter {idx+1}')
        require(page.locator('[data-starter-index]').count()==5, 'Style 2 starter selector exposes non-current options')
        page.locator(f'[data-starter-index="{idx}"]').click()
        require(page.locator('#deckCount').text_content().strip() == '60', f'Starter {idx+1} did not load 60 cards')
        obj=page.evaluate('exportObject()')
        require(obj.get('main_deck_count')==60, f'Starter {idx+1} exportObject total mismatch')
        require('OSA v1.9.1' in obj.get('format',''), f'Starter {idx+1} export metadata is stale')
        # Actual app import-normalization/application roundtrip.
        page.evaluate('obj=>applyDeck(normalizeImportedDeck(obj))', obj)
        obj2=page.evaluate('exportObject()')
        sem=lambda o:(o.get('legacy_deck_package_slots'),o.get('main_deck'),o.get('default_formation'))
        require(sem(obj2)==sem(obj), f'Starter {idx+1} app export/import semantic roundtrip changed composition')
        exported.append(obj)
    return exported


def run_style2_desktop(browser, expected_size):
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page.set_default_timeout(10000)
    page.set_content(inline_page(2), wait_until='domcontentloaded', timeout=20000)
    starter_exports = verify_all_starters_application(page)

    # Start blank before hover/deck interaction tests.
    page.locator('#clearDeck').click()
    if page.locator('#confirmDialog').is_visible(): page.locator('#confirmOk').click()
    page.locator('#mainTabButton').click()
    require(page.locator('#hoverCardZoom').count() == 1, 'Style 2 must use one preview overlay')

    # Hero selection and filter paths remain functional.
    page.locator('#legacyTabButton').click()
    chooser=page.locator('[data-choose-hero]').first; chooser.click()
    choice=page.locator('[data-progression-choice]:not([disabled])').first; require(choice.count()==1,'Style 2 no selectable Hero progression'); choice.click()
    require(page.locator('.hero-slot .card-stage img').count()>=1,'Style 2 Hero selection failed')
    page.locator('#mainTabButton').click()
    page.locator('#filterToggle').click(); page.locator('#familyFilter').select_option('Item')
    filtered_ids=page.locator('[data-library-card]').evaluate_all('els=>els.map(e=>e.dataset.libraryCard)')
    require(filtered_ids,'Style 2 Item filter returned none')
    non_items=page.evaluate("ids=>ids.filter(id=>{const d=window.GL_DECK_BUILDER_DATA;const c=[...d.mainCards,...d.legacyCards].find(x=>x.id===id);return !c||c.family!=='Item'})",filtered_ids)
    require(not non_items,'Style 2 Item filter leaked non-Items')
    page.locator('#resetFilters').click()

    preview=page.locator('#hoverCardZoom')
    compatible=page.locator('.library-card:not(.incompatible)')
    require(compatible.count()>=6,'Style 2 needs compatible cards for direct-hover tests')
    boxes=[]
    for i in range(min(compatible.count(),18)):
        b=compatible.nth(i).bounding_box()
        if b: boxes.append((i,b))
    pairs=same_row_pairs(boxes,'right')
    require(pairs,'Style 2 could not find adjacent Library cards in same row')
    _,ai,bi=pairs[0]
    a=compatible.nth(ai); b=compatible.nth(bi)
    aid=a.get_attribute('data-library-card'); bid=b.get_attribute('data-library-card'); btitle=b.get_attribute('title')
    a.hover(); require(preview_visible(page),'Style 2 Library preview A missing')
    ab=a.bounding_box(); ap=preview.bounding_box(); require(ab and ap,'Style 2 Library geometry missing')
    require(abs(ap['width']-expected_size[0])<1 and abs(ap['height']-expected_size[1])<1,'Style 2 preview size differs from Style 1')
    require(ap['x']>=ab['x']+ab['width']+5,'Style 2 Library preview not RIGHT')
    require(preview.evaluate('e=>getComputedStyle(e).pointerEvents')=='none','Style 2 preview pointer-events is not none')
    alt_a=page.locator('#hoverCardZoomImage').get_attribute('alt')
    # Direct A -> adjacent B toward preview direction. This failed under the old suppression rectangle.
    b.hover(); alt_b=page.locator('#hoverCardZoomImage').get_attribute('alt')
    require(preview_visible(page) and alt_b!=alt_a and alt_b==f'{btitle} preview', 'Style 2 direct Library A→B did not transfer preview ownership')
    # Reverse B -> A.
    a.hover(); alt_a2=page.locator('#hoverCardZoomImage').get_attribute('alt')
    require(preview_visible(page) and alt_a2==alt_a,'Style 2 Library reverse B→A failed')
    # Empty area ends preview.
    page.mouse.move(10,10); require(preview.is_hidden(),'Style 2 Library preview persists into empty area')
    require(page.locator('#hoverCardZoom').count()==1,'Style 2 created multiple preview overlays')

    # Add three library cards and test deck-side direct right->left hover.
    add_ids=[]
    for i in range(compatible.count()):
        cid=compatible.nth(i).get_attribute('data-library-card')
        if cid and cid not in add_ids:
            add_ids.append(cid)
        if len(add_ids)>=3: break
    for cid in add_ids:
        page.locator(f'[data-library-card="{cid}"]').click()
    deck_cards=page.locator('[data-deck-card]'); require(deck_cards.count()>=3,'Style 2 could not build deck hover fixtures')
    dboxes=[]
    for i in range(deck_cards.count()):
        bb=deck_cards.nth(i).bounding_box()
        if bb: dboxes.append((i,bb))
    dpairs=same_row_pairs(dboxes,'left')
    require(dpairs,'Style 2 could not find adjacent Deck cards same row')
    _,ri,li=dpairs[0]
    right=deck_cards.nth(ri); left=deck_cards.nth(li)
    right_title=right.get_attribute('title'); left_title=left.get_attribute('title')
    right.hover(); rp=preview.bounding_box(); rb=right.bounding_box(); require(rp and rb,'Style 2 Deck geometry missing')
    require(rp['x']+rp['width']<=rb['x']-5,'Style 2 Deck preview not LEFT')
    ralt=page.locator('#hoverCardZoomImage').get_attribute('alt')
    left.hover(); lalt=page.locator('#hoverCardZoomImage').get_attribute('alt')
    require(preview_visible(page) and lalt!=ralt and lalt==f'{left_title} preview','Style 2 direct Deck right→left did not transfer preview ownership')
    right.hover(); require(page.locator('#hoverCardZoomImage').get_attribute('alt')==f'{right_title} preview'==ralt,'Style 2 Deck reverse left→right failed')
    page.mouse.move(10,10); require(preview.is_hidden(),'Style 2 Deck preview persists into empty area')

    # Real file export/import flow with Warp Scroll + Freeze Bomb.
    for name,cid in [('Warp Scroll','S1-ITM-019'),('Freeze Bomb','S1-ITM-020')]:
        page.locator('#searchInput').fill(name)
        tile=page.locator(f'[data-library-card="{cid}"]'); require(tile.count()==1,f'{name} missing'); tile.click()
    page.locator('#searchInput').fill('')
    page.locator('#exportJson').click()
    if page.locator('#confirmDialog').is_visible():
        with page.expect_download(timeout=10000) as info: page.locator('#confirmOk').click()
    else:
        raise AssertionError('Expected incomplete-deck export confirmation did not open')
    exported_path=info.value.path(); exported=json.loads(Path(exported_path).read_text(encoding='utf-8'))
    require('OSA v1.9.1' in exported.get('format',''),'Style 2 file export metadata is not OSA v1.9.1')
    exported_ids={x['card_id'] for x in exported.get('main_deck',[])}; require({'S1-ITM-019','S1-ITM-020'}<=exported_ids,'Warp/Freeze lost during export')
    page.locator('#clearDeck').click();
    if page.locator('#confirmDialog').is_visible(): page.locator('#confirmOk').click()
    page.set_input_files('#jsonFileInput',exported_path); page.wait_for_timeout(100); page.locator('#mainTabButton').click()
    require(page.locator('[data-deck-card="S1-ITM-019"]').count()==1,'Warp Scroll identity lost on file import')
    require(page.locator('[data-deck-card="S1-ITM-020"]').count()==1,'Freeze Bomb identity lost on file import')
    page.close()


def run_style2_mobile(browser):
    page=browser.new_page(viewport={'width':700,'height':900}); page.set_default_timeout(8000)
    page.set_content(inline_page(2),wait_until='domcontentloaded',timeout=20000); page.locator('#mainTabButton').click()
    tile=page.locator('[data-library-card="S1-ITM-019"]'); require(tile.count()==1,'Warp Scroll missing mobile'); tile.hover(); require(page.locator('#hoverCardZoom').is_hidden(),'Desktop hover forced onto mobile')
    tile.click(); row=page.locator('[data-mobile-deck-card="S1-ITM-019"]'); require(row.count()==1,'Warp not added mobile')
    before=int(row.locator('.mobile-main-qty').text_content()); row.locator('[data-mobile-add="S1-ITM-019"]').click(); row=page.locator('[data-mobile-deck-card="S1-ITM-019"]'); require(int(row.locator('.mobile-main-qty').text_content())==before+1,'Mobile + regressed'); row.locator('[data-mobile-remove="S1-ITM-019"]').click(); row=page.locator('[data-mobile-deck-card="S1-ITM-019"]'); require(int(row.locator('.mobile-main-qty').text_content())==before,'Mobile - regressed'); page.close()


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=CHROMIUM,args=['--no-sandbox'])
        try:
            size=run_style1(browser)
            run_style2_desktop(browser,size)
            run_style2_mobile(browser)
        finally:
            browser.close()
    print('PASS Deck Builder v1.31 OSA v1.9.1 starters + Style1 row anchor + Style2 direct card hover browser regression')

if __name__=='__main__':
    try: main()
    except Exception as exc:
        print(f'FAIL Deck Builder v1.31 browser regression: {exc}',file=sys.stderr)
        raise
