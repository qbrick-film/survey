import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("G", "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"))
OUT_PDF = "/mnt/user-data/outputs/紫熊祭2026_上映アンケート.pdf"
W, H, BOX, MARK = 210, 297, 5.0, 10.0
markers = [(16,16),(194,16),(16,281),(194,281)]
QUIET = 4.0  # マーク周囲の余白(mm)。ここには何も印刷しない
c = canvas.Canvas(OUT_PDF, pagesize=A4)
c.setTitle("紫熊祭2026 映画研究部 上映アンケート")
def Y(y): return (H - y) * mm
def text(x, y, s, size=10, center=False, gray=0):
    c.setFillGray(gray); c.setFont("G", size)
    (c.drawCentredString if center else c.drawString)(x*mm, Y(y), s); c.setFillGray(0)
def box(x, y, fill=False):
    c.setStrokeGray(0.35); c.setLineWidth(0.7); c.setFillGray(0.15 if fill else 1)
    c.rect((x-BOX/2)*mm, Y(y+BOX/2), BOX*mm, BOX*mm, stroke=1, fill=1 if fill else 0); c.setFillGray(0)
c.setFillGray(0)
for (x,y) in markers: c.rect((x-MARK/2)*mm, Y(y+MARK/2), MARK*mm, MARK*mm, stroke=0, fill=1)
c.rect(28*mm, Y(18), 4*mm, 4*mm, stroke=0, fill=1)  # 上下判定ドット (30,16)
# 用紙識別用の小さな文字（右下マークの左）
text(150, 282.5, "SQ26-上映 v2", 6.5, gray=0.45)
text(105, 25, "紫熊祭2026 映画研究部 上映アンケート", 16, True)
text(105, 32, "ご来場ありがとうございました。作品ごとに1枚ご記入ください。", 9.5, True)
c.setStrokeGray(0.6); c.setLineWidth(0.5); c.roundRect(24*mm, Y(46), 162*mm, 10*mm, 1.5*mm, stroke=1, fill=0)
text(28, 42.3, "記入方法：あてはまる□を黒く塗りつぶしてください。", 9)
text(128, 42.3, "良い例", 8.5); box(141, 41.2, True)
text(149, 42.3, "悪い例", 8.5); box(162, 41.2)
c.setStrokeGray(0.2); c.setLineWidth(1)
c.line(160.5*mm, Y(41.3), 161.8*mm, Y(42.8)); c.line(161.8*mm, Y(42.8), 164*mm, Y(39.2))
box(174, 41.2); c.circle(174*mm, Y(41.2), 3.4*mm, stroke=1, fill=0)

spec = dict(page=dict(w=W,h=H), orient=[30,16], markers=markers, markerSize=MARK, quiet=QUIET, box=BOX, sample=3.2, questions=[])
def choice(qid, qtype, label, y, opts, per_row, colw, extra=None, num=True):
    text(22, y, label, 10.5)
    out = []
    for k, o in enumerate(opts):
        r, col = divmod(k, per_row)
        bx, by = 25 + col*colw, y + 7 + r*7
        box(bx, by); text(bx+4, by+1.3, f"{k+1} {o}" if num else o, 9.5)
        if extra and extra[k]: text(bx+30, by+1.3, extra[k], 8.5, gray=0.25)
        out.append(dict(n=k+1, label=o, x=bx, y=by))
    rows = (len(opts)-1)//per_row + 1
    spec["questions"].append(dict(id=qid, type=qtype, label=label, options=out,
        region=dict(x=18, y=y-5, w=174, h=7 + rows*7 + 3)))
def free(qid, label, y, h):
    text(22, y, label, 10.5)
    bx, by, bw = 22, y+3, 166
    c.setStrokeGray(0.72); c.setLineWidth(0.8); c.rect(bx*mm, Y(by+h), bw*mm, h*mm, stroke=1, fill=0)
    c.setStrokeGray(0.86); c.setLineWidth(0.4); c.setDash(1,2)
    for ly in range(10, int(h), 10): c.line((bx+3)*mm, Y(by+ly), (bx+bw-3)*mm, Y(by+ly))
    c.setDash()
    spec["questions"].append(dict(id=qid, type="text", label=label, options=[], region=dict(x=bx,y=by,w=bw,h=h)))

choice("Q1","single","Q1. この用紙でお答えいただく作品（1つ）", 53,
       ["アネミー","お腹で金魚を飼う話","あいにいく","トキオさん","えーちゃんの引っ越し"], 3, 56)
choice("Q2","single","Q2. このアンケートのご記入は今日何枚目ですか（1つ）", 76,
       ["1枚目","2枚目以降"], 1, 0, extra=["→ Q3〜Q7 すべてお答えください","→ Q5 はとばしてください"], num=False)
choice("Q3","multi","Q3. 良かった点（いくつでも）", 99,
       ["ストーリー","カメラワーク","演技","BGM・効果音","全体の長さ","その他"], 3, 56)
choice("Q4","multi","Q4. 改善してほしい点（いくつでも）", 122,
       ["ストーリー","カメラワーク","演技","BGM・効果音","全体の長さ","その他"], 3, 56)
# Q5 囲み
c.setStrokeGray(0); c.setLineWidth(1.8); c.rect(18*mm, Y(175), 174*mm, 31*mm, stroke=1, fill=0)
c.setFillGray(0); c.rect(18*mm, Y(150), 32*mm, 6*mm, stroke=0, fill=1)
text(20.5, 148.4, "1枚目の方のみ", 9.5, gray=1)
text(54, 148.4, "2枚目以降の方はQ6へお進みください", 8.5, gray=0.3)
choice("Q5","multi","Q5. 見たい・好きな映画のジャンル（いくつでも）", 156,
       ["アクション","SF・ファンタジー","コメディ","ホラー","恋愛","ミステリー","ファミリー","その他"], 4, 42)
free("Q6","Q6. この作品の感想・制作者へのメッセージをご自由にお書きください", 183, 32)
free("Q7","Q7. 「その他」を選んだ方はその内容を、そのほかご意見があればお書きください", 224, 32)
text(105, 265, "ご協力ありがとうございました。記入後はスタッフにお渡しください。", 9.5, True)
text(105, 270, "※ 用紙は折らないでください。四隅の黒い四角のまわりには記入しないでください（機械で読み取ります）", 7.5, True)
c.showPage(); c.save()
json.dump(spec, open("/home/claude/omr/layout_screening.json","w"), ensure_ascii=False)
print("ok")
