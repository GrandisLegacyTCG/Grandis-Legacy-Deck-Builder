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
    # The execution environment blocks browser navigation, so execute the actual
    # repository HTML/CSS/JS in a document assembled from the checked-in files.
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
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.set_default_timeout(8000)
    page.set_content(inline_page(1), wait_until='domcontentloaded', timeout=20000)
    require(page.locator('[data-starter-index]').count() == 15, 'Style 1 should expose all 15 Starter60 presets')
    page.locator('[data-starter-index]').first.click()
    require(not page.locator('#newDeckDialog').is_visible(), 'Style 1 starter dialog did not close')
    page.locator('[data-section-toggle="main"]').click()
    row = page.locator('.main-deck-row:has(button[data-add-main]:not([disabled]))').first
    require(row.count() == 1, 'Style 1 could not find a deck row with usable + control')
    row.hover()
    require(preview_visible(page), 'Style 1 preview did not appear on source hover')
    preview = page.locator('#hoverCardZoom')
    pb = preview.bounding_box(); deck = page.locator('.deck-shell').bounding_box()
    require(pb and deck, 'Style 1 preview/deck geometry unavailable')
    require(abs((pb['x'] + pb['width']/2) - deck['x']) <= 24, 'Style 1 preview center is not near the left edge of deck panel')
    require(pb['x'] >= 0 and pb['y'] >= 0 and pb['x']+pb['width'] <= 1440 and pb['y']+pb['height'] <= 1000, 'Style 1 preview overflows viewport')
    controls = row.locator('.qty-control')
    for i in range(controls.count()):
        cb = controls.nth(i).bounding_box()
        require(cb and not intersects(pb, cb), 'Style 1 preview overlaps a +/- control')
    require(preview.evaluate('e=>getComputedStyle(e).pointerEvents') == 'none', 'Style 1 preview captures pointer events')
    before = int(row.locator('.main-qty').text_content())
    row.locator('[data-add-main]').click()
    row = page.locator('.main-deck-row:has(button[data-add-main],button[data-remove-main])').filter(has_text=row.locator('.main-card-info strong').text_content()).first
    after = int(row.locator('.main-qty').text_content())
    require(after == before + 1, 'Style 1 + control is not usable with preview behavior')
    row.hover(); pb = preview.bounding_box(); require(pb, 'Style 1 preview missing after deck rerender')
    page.mouse.move(pb['x'] + pb['width']/2, pb['y'] + pb['height']/2)
    require(preview.is_hidden(), 'Style 1 preview did not hide immediately when pointer left source toward preview')
    size = (250, 350)
    row.hover(); pb = preview.bounding_box(); require(abs(pb['width']-250) < 1 and abs(pb['height']-350) < 1, 'Style 1 approved preview size changed')
    page.close()
    return size


def run_style2_desktop(browser, expected_size):
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.set_content(inline_page(2), wait_until='domcontentloaded', timeout=20000)

    # Existing Hero-selection and tab workflows must remain functional.
    chooser = page.locator('[data-choose-hero]').first
    require(chooser.count() == 1, 'Style 2 Hero selector missing')
    chooser.click()
    require(page.locator('#heroPickerDialog').is_visible(), 'Style 2 Hero picker did not open')
    choice = page.locator('[data-progression-choice]:not([disabled])').first
    require(choice.count() == 1, 'Style 2 Hero picker has no selectable progression')
    choice.click()
    require(not page.locator('#heroPickerDialog').is_visible(), 'Style 2 Hero picker did not close after selection')
    require(page.locator('.hero-slot .card-stage img').count() >= 1, 'Style 2 Hero selection did not render a Hero')

    page.locator('#mainTabButton').click()
    require(page.locator('#mainTabButton').get_attribute('class').find('active') >= 0, 'Style 2 Main Deck tab did not activate')
    require(page.locator('#hoverCardZoom').count() == 1, 'Style 2 must use one preview overlay')

    # Exercise the real filter path and verify it returns only canonical Item cards.
    page.locator('#filterToggle').click()
    page.locator('#familyFilter').select_option('Item')
    filtered_ids = page.locator('[data-library-card]').evaluate_all("els=>els.map(e=>e.dataset.libraryCard)")
    require(len(filtered_ids) > 0, 'Style 2 Item filter returned no cards')
    non_items = page.evaluate("ids=>ids.filter(id=>{const d=window.GL_DECK_BUILDER_DATA;const c=[...d.mainCards,...d.legacyCards].find(x=>x.id===id);return !c||c.family!=='Item'})", filtered_ids)
    require(not non_items, 'Style 2 Item filter leaked non-Item cards')
    page.locator('#resetFilters').click()
    compatible = page.locator('.library-card:not(.incompatible)')
    require(compatible.count() >= 2, 'Style 2 needs at least two compatible library cards for hover regression')
    first = compatible.nth(0); first_title = first.get_attribute('title')
    first.hover(); preview = page.locator('#hoverCardZoom'); require(preview_visible(page), 'Style 2 library preview missing')
    sb = first.bounding_box(); pb = preview.bounding_box(); require(sb and pb, 'Style 2 library geometry unavailable')
    require(abs(pb['width']-expected_size[0]) < 1 and abs(pb['height']-expected_size[1]) < 1, 'Style 2 preview size differs from Style 1')
    require(pb['x'] >= sb['x'] + sb['width'] + 5, 'Style 2 Library preview is not on the RIGHT of source card')
    require(pb['x'] + pb['width'] <= 1440 and pb['y'] >= 0 and pb['y'] + pb['height'] <= 1000, 'Style 2 Library preview overflows viewport')
    require(preview.evaluate('e=>getComputedStyle(e).pointerEvents') == 'none', 'Style 2 preview captures pointer events')
    # Cross the source card's right edge toward the preview.  The source-card
    # mouseleave must hide immediately; only then move into the former preview
    # area so another source tile on the path cannot create a false failure.
    page.mouse.move(sb['x'] + sb['width'] + 2, sb['y'] + sb['height']/2)
    require(preview.is_hidden(), 'Style 2 Library preview persists after source mouseleave toward preview')
    page.mouse.move(pb['x'] + pb['width']/2, pb['y'] + pb['height']/2)
    require(preview.is_hidden(), 'Style 2 Library preview reappears when pointer enters former preview area')

    # Rapid card-to-card hover must reuse the singleton and show Card B.  Pick
    # a second source outside Card A's preview rectangle so this tests genuine
    # source-to-source movement rather than the separate anti-hover-bridge path.
    first.hover(); alt_a = page.locator('#hoverCardZoomImage').get_attribute('alt')
    rapid_pb = preview.bounding_box(); require(rapid_pb, 'Style 2 rapid-hover preview geometry unavailable')
    second = None
    for i in range(1, compatible.count()):
        candidate = compatible.nth(i)
        cb = candidate.bounding_box()
        if not cb:
            continue
        cx, cy = cb['x'] + cb['width']/2, cb['y'] + cb['height']/2
        if not (rapid_pb['x'] <= cx <= rapid_pb['x'] + rapid_pb['width'] and rapid_pb['y'] <= cy <= rapid_pb['y'] + rapid_pb['height']):
            second = candidate
            break
    require(second is not None, 'Style 2 could not find a second card outside the preview overlay')
    second.hover(); alt_b = page.locator('#hoverCardZoomImage').get_attribute('alt')
    require(alt_a != alt_b and alt_b and alt_b.endswith(' preview') and preview.is_visible(), 'Style 2 rapid hover did not update to Card B')
    require(page.locator('#hoverCardZoom').count() == 1, 'Style 2 created multiple preview overlays')
    page.mouse.move(10, 10)

    # Add a compatible card and verify deck-side LEFT placement.
    first = page.locator('.library-card:not(.incompatible)').filter(has_text='').first
    first.click()
    deck_card = page.locator('[data-deck-card]').first
    require(deck_card.count() == 1, 'Style 2 deck card was not added')
    deck_card.hover(); pb = preview.bounding_box(); db = deck_card.bounding_box(); require(pb and db, 'Style 2 deck geometry unavailable')
    require(pb['x'] + pb['width'] <= db['x'] - 5, 'Style 2 Deck preview is not on the LEFT of source card')
    # Cross the source card's left edge toward the preview, then enter the
    # former preview area after it has already been hidden.
    page.mouse.move(db['x'] - 2, db['y'] + db['height']/2)
    require(preview.is_hidden(), 'Style 2 Deck preview persists after source mouseleave toward preview')
    page.mouse.move(pb['x'] + pb['width']/2, pb['y'] + pb['height']/2)
    require(preview.is_hidden(), 'Style 2 Deck preview reappears when pointer enters former preview area')

    # Add Warp Scroll + Freeze Bomb through the real library UI.
    for name, cid in [('Warp Scroll','S1-ITM-019'),('Freeze Bomb','S1-ITM-020')]:
        page.locator('#searchInput').fill(name)
        tile = page.locator(f'[data-library-card="{cid}"]')
        require(tile.count() == 1, f'{name} missing from Style 2 library')
        tile.click()
    page.locator('#searchInput').fill('')
    # Export through the actual application flow.
    page.locator('#exportJson').click()
    require(page.locator('#confirmDialog').is_visible(), 'Style 2 incomplete export confirmation did not open')
    with page.expect_download(timeout=8000) as download_info:
        page.locator('#confirmOk').click()
    download = download_info.value
    exported_path = download.path()
    exported = json.loads(Path(exported_path).read_text(encoding='utf-8'))
    exported_ids = {x['card_id'] for x in exported.get('main_deck', [])}
    require({'S1-ITM-019','S1-ITM-020'} <= exported_ids, 'Warp Scroll / Freeze Bomb lost during export')
    require('OSA v1.9.0' in exported.get('format',''), 'Export metadata does not identify OSA v1.9.0')
    # Clear and import the exported file through the actual file input path.
    page.locator('#clearDeck').click(); require(page.locator('#confirmDialog').is_visible(), 'Clear confirmation missing')
    page.locator('#confirmOk').click()
    require(page.locator('#deckCount').text_content().strip() == '0', 'Style 2 deck did not clear')
    page.set_input_files('#jsonFileInput', exported_path)
    page.wait_for_timeout(100)
    page.locator('#mainTabButton').click()
    require(page.locator('[data-deck-card="S1-ITM-019"]').count() == 1, 'Warp Scroll identity lost on import')
    require(page.locator('[data-deck-card="S1-ITM-020"]').count() == 1, 'Freeze Bomb identity lost on import')
    page.close()


def run_style2_mobile(browser):
    page = browser.new_page(viewport={'width': 700, 'height': 900})
    page.set_default_timeout(8000)
    page.set_content(inline_page(2), wait_until='domcontentloaded', timeout=20000)
    page.locator('#mainTabButton').click()
    tile = page.locator('[data-library-card="S1-ITM-019"]')
    require(tile.count() == 1, 'Warp Scroll missing in mobile Style 2 library')
    tile.hover()
    require(page.locator('#hoverCardZoom').is_hidden(), 'Desktop hover preview was forced onto mobile')
    tile.click()
    row = page.locator('[data-mobile-deck-card="S1-ITM-019"]')
    require(row.count() == 1, 'Warp Scroll not added to mobile deck list')
    qty = row.locator('.mobile-main-qty'); before = int(qty.text_content())
    row.locator('[data-mobile-add="S1-ITM-019"]').click()
    row = page.locator('[data-mobile-deck-card="S1-ITM-019"]'); after = int(row.locator('.mobile-main-qty').text_content())
    require(after == before + 1, 'Style 2 mobile + control regressed')
    row.locator('[data-mobile-remove="S1-ITM-019"]').click()
    row = page.locator('[data-mobile-deck-card="S1-ITM-019"]'); final = int(row.locator('.mobile-main-qty').text_content())
    require(final == before, 'Style 2 mobile - control regressed')
    page.close()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROMIUM, args=['--no-sandbox'])
        try:
            size = run_style1(browser)
            run_style2_desktop(browser, size)
            run_style2_mobile(browser)
        finally:
            browser.close()
    print('PASS Deck Builder v1.31 executable browser preview geometry/lifecycle + Warp/Freeze import-export regression')

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'FAIL Deck Builder v1.31 browser regression: {exc}', file=sys.stderr)
        raise
