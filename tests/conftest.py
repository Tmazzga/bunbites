"""Shared fixtures: serve the app locally and give each test a fresh phone-sized browser page."""
import functools, http.server, json, os, socketserver, threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PORT = int(os.environ.get("BUNBITES_PORT", "8799"))


@pytest.fixture(scope="session")
def base_url():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{PORT}/"
    httpd.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        exe = os.environ.get("CHROME_PATH")  # optional: use a system Chrome instead of Playwright's
        b = p.chromium.launch(executable_path=exe or None, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture
def page(browser, base_url):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                              service_workers="block")
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    # never hit the network in tests: fonts, scanner library and food database are stubbed
    pg.route("**fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))
    pg.route("**unpkg.com/**", lambda r: r.fulfill(status=200, content_type="application/javascript", body=SCANNER_STUB))
    pg.goto(base_url)
    pg.evaluate("localStorage.clear()")
    pg.reload()
    yield pg
    assert not pg.errors, f"JavaScript errors: {pg.errors}"
    ctx.close()


SCANNER_STUB = """
window.Html5QrcodeSupportedFormats={EAN_13:1,EAN_8:2,UPC_A:3,UPC_E:4,CODE_128:5};
window.Html5Qrcode=class{constructor(id){this.id=id;}
  async start(){document.getElementById(this.id).innerHTML='<div style="height:200px;background:#333"></div>';}
  async stop(){} clear(){}
  async scanFileV2(){ if(window.__scanFail) throw new Error('none'); return {decodedText: window.__scanCode || '0029000016743'}; }};
"""


def start(page, name="Clover"):
    """Finish onboarding and silence unlock pop-ups so tests don't have to dismiss them."""
    page.fill("#petname", name)
    page.click('[data-a="start"]')
    page.evaluate("S.seenUnlocks = ACCESSORIES.map(a => a.id); save()")


def state(page):
    return json.loads(page.evaluate("localStorage.getItem('bunbites.v1')"))


def log_food(page, query, servings=None):
    page.click('[data-a="add"] >> nth=0')
    page.fill("#q", query)
    page.click('#results [data-a="pick"] >> nth=0')
    if servings is not None:
        page.fill("#servc", str(servings))
    page.click('[data-a="logpick"]')
    page.keyboard.press("Escape")
