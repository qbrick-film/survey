# 実スキャン1枚目から、わざと悪条件の画像を作る
from PIL import Image, ImageDraw
import sys
src=Image.open(sys.argv[1]).convert('L'); W,H=src.size; p=W/210; out=sys.argv[2]
def save(im,name): im.save(f'{out}/{name}.pgm')
save(src.rotate(180),'a_upside')
save(src.rotate(2.5,resample=Image.BILINEAR,fillcolor=255),'b_rot2_5')
im=src.copy(); d=ImageDraw.Draw(im); x=int(25*p); d.line([(x,0),(x,H)],fill=40,width=2); save(im,'c_scanner_streak')
im=src.copy(); d=ImageDraw.Draw(im)
for y in (16,281): d.rectangle([0,int((y-0.2)*p),W,int((y+1.3)*p)],fill=255)
save(im,'d_white_band_1_5mm')
im=Image.new('L',(W,H),255); s=src.resize((int(W*0.94),int(H*0.94))); im.paste(s,((W-s.width)//2,(H-s.height)//2)); save(im,'e_fit_to_page_94')
im=Image.new('L',(W,H),20); s=src.rotate(1.5,resample=Image.BILINEAR,fillcolor=255).resize((int(W*0.97),int(H*0.97))); im.paste(s,(int(W*0.015),int(H*0.02))); save(im,'f_black_border')
im=src.copy(); d=ImageDraw.Draw(im); d.ellipse([int(186*p),int(8*p),int(204*p),int(26*p)],fill=255); d.line([(int(185*p),int(10*p)),(int(200*p),int(24*p))],fill=60,width=6); save(im,'g_marker_damaged')
