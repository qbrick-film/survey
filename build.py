"""src を結合して dist/index.html（GitHub Pages 用）を作る"""
import pathlib
root = pathlib.Path(__file__).parent
s = (root/"src/app.html").read_text(encoding="utf-8")
core = (root/"src/core.js").read_text(encoding="utf-8").replace('if (typeof module !== "undefined") module.exports = OMR;', '')
s = s.replace("/*CORE*/", core).replace("/*SPEC*/", (root/"src/layout.json").read_text(encoding="utf-8").strip())
(root/"dist").mkdir(exist_ok=True)
full = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + s + '</body></html>')
(root/"dist/index.html").write_text(full, encoding="utf-8")
print("built")
