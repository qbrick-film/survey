// ---- OMR core: 純粋関数（グレースケール画像 {w,h,data:Uint8Array} を受け取る）----
const OMR = (() => {
  // 紙の白さを推定（95パーセンタイル）
  function paperWhite(g) {
    const hist = new Uint32Array(256); let n = 0;
    for (let i = 0; i < g.data.length; i += 7) { hist[g.data[i]]++; n++; }
    let acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.05) return Math.max(v, 120); }
    return 255;
  }
  // 2値画像のクロージング（膨張→収縮）で細い切れ目をつなぐ。正方形の構造要素、半径 r
  function boxMax(src, w, h, r, val) { // val=1:膨張, val=0:収縮
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { // 横方向
      let cnt = 0; const row = y * w;
      for (let x = -r; x < w; x++) {
        if (x + r < w && src[row + x + r] === val) cnt++;
        if (x - r - 1 >= 0 && src[row + x - r - 1] === val) cnt--;
        if (x >= 0) tmp[row + x] = cnt > 0 ? val : 1 - val;
      }
    }
    for (let x = 0; x < w; x++) { // 縦方向
      let cnt = 0;
      for (let y = -r; y < h; y++) {
        if (y + r < h && tmp[(y + r) * w + x] === val) cnt++;
        if (y - r - 1 >= 0 && tmp[(y - r - 1) * w + x] === val) cnt--;
        if (y >= 0) out[y * w + x] = cnt > 0 ? val : 1 - val;
      }
    }
    return out;
  }
  function close(bin, w, h, r) { return boxMax(boxMax(bin, w, h, r, 1), w, h, r, 0); }
  function components(bin, w, h) {
    const lab = new Int32Array(w * h), stack = new Int32Array(w * h), out = [];
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!bin[s] || lab[s]) continue;
      id++; let sp = 0; stack[sp++] = s; lab[s] = id;
      let n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
      while (sp) {
        const j = stack[--sp], x = j % w, y = (j / w) | 0;
        n++; sx += x; sy += y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && bin[j - 1] && !lab[j - 1]) { lab[j - 1] = id; stack[sp++] = j - 1; }
        if (x < w - 1 && bin[j + 1] && !lab[j + 1]) { lab[j + 1] = id; stack[sp++] = j + 1; }
        if (y > 0 && bin[j - w] && !lab[j - w]) { lab[j - w] = id; stack[sp++] = j - w; }
        if (y < h - 1 && bin[j + w] && !lab[j + w]) { lab[j + w] = id; stack[sp++] = j + w; }
      }
      out.push({ n, cx: sx / n, cy: sy / n, x0, x1, y0, y1 });
    }
    return out;
  }
  // 四隅のマークを探す。見つからない隅は null
  function findMarkers(g, spec, white) {
    const { w, h, data } = g;
    const ppm = w / spec.page.w, exp = spec.markerSize * ppm;
    const thr = Math.min(white * 0.55, 150);
    const ww = Math.round(w * 0.25), wh = Math.round(h * 0.18);
    const wins = [[0, 0], [w - ww, 0], [0, h - wh], [w - ww, h - wh]];
    const corners = [[0, 0], [w, 0], [0, h], [w, h]];
    const r = Math.max(1, Math.round(0.9 * ppm)); // 約1.8mmまでの白線をつなぐ
    return wins.map(([ox, oy], k) => {
      const bin = new Uint8Array(ww * wh);
      for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) bin[y * ww + x] = data[(oy + y) * w + ox + x] < thr ? 1 : 0;
      const cl = close(bin, ww, wh, r);
      let best = null, bestD = Infinity;
      for (const c of components(cl, ww, wh)) {
        const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
        if (bw < exp * 0.55 || bh < exp * 0.55 || bw > exp * 1.6 || bh > exp * 1.6) continue;
        if (bw / bh < 0.7 || bw / bh > 1.43) continue;
        if (c.n / (bw * bh) < 0.75) continue;
        // 枠や罫線の角ではなく塗りつぶしの正方形か：中心部が黒いこと
        const cx = ox + c.cx, cy = oy + c.cy;
        const d = Math.hypot(cx - corners[k][0], cy - corners[k][1]);
        if (d < bestD) { bestD = d; best = [cx, cy]; }
      }
      return best;
    });
  }
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) if (r !== c) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c];
      }
    }
    return b.map((v, i) => v / A[i][i]);
  }
  function apply(H, x, y) {
    const d = H[6] * x + H[7] * y + 1;
    return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d];
  }
  // スキャナーのガラスの汚れによる「端から端まで続く線」を探す（列と行）
  function findStreaks(g, white) {
    const { w, h, data } = g, thr = white * 0.8;
    const bands = (len, other, get) => { // 両端の帯(2〜6%と94〜98%)で、ほぼ全部黒い位置
      const res = new Set();
      const a0 = Math.round(other * 0.02), a1 = Math.round(other * 0.06), b0 = Math.round(other * 0.94), b1 = Math.round(other * 0.98);
      for (let i = 0; i < len; i++) {
        let da = 0, db = 0;
        for (let t = a0; t < a1; t++) if (get(i, t) < thr) da++;
        for (let t = b0; t < b1; t++) if (get(i, t) < thr) db++;
        if (da > (a1 - a0) * 0.9 && db > (b1 - b0) * 0.9) for (let k = -2; k <= 2; k++) res.add(i + k);
      }
      return res.size > len * 0.05 ? new Set() : res; // 広すぎるものは線ではない（黒い縁など）
    };
    return {
      cols: bands(w, h, (x, y) => data[y * w + x]),
      rows: bands(h, w, (y, x) => data[y * w + x]),
    };
  }
  function px(g, x, y) {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= g.w || iy >= g.h) return 255;
    return g.data[iy * g.w + ix];
  }
  function darkRatio(g, H, cx, cy, size, thr, streaks) {
    const N = 16; let d = 0, n = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const [x, y] = apply(H, cx - size / 2 + size * (i + 0.5) / N, cy - size / 2 + size * (j + 0.5) / N);
      if (streaks && (streaks.cols.has(Math.round(x)) || streaks.rows.has(Math.round(y)))) continue;
      n++; if (px(g, x, y) < thr) d++;
    }
    return n ? d / n : 0;
  }
  // 4点（TL,TR,BL,BR の画像座標）から変換を作り、上下判定ドットで向きを確定
  function locateFrom(g, spec, m, white) {
    const thr = white * 0.6, P = spec.markers, [ox, oy] = spec.orient;
    for (const order of [[0, 1, 2, 3], [3, 2, 1, 0]]) {
      const H = homography(P, order.map(i => m[i]));
      if (darkRatio(g, H, ox, oy, 2.5, thr) >= 0.5) return { H, flipped: order[0] === 3 };
    }
    return null;
  }
  function classify(ratios, q, fillT, faintT) {
    const marked = ratios.map((r, i) => r >= fillT ? i + 1 : 0).filter(Boolean);
    const faint = ratios.map((r, i) => r >= faintT && r < fillT ? i + 1 : 0).filter(Boolean);
    const flags = [];
    if (faint.length) flags.push("薄いマーク: " + faint.join(","));
    if (q.type !== "multi" && marked.length > 1) flags.push("複数マーク");
    if (q.type !== "multi" && marked.length === 0 && !faint.length) flags.push("無回答");
    return { marked, faint, flags };
  }
  function measure(g, spec, loc, white, streaks) {
    const thr = white * 0.8, q = {};
    for (const qq of spec.questions) if (qq.type !== "text")
      q[qq.id] = qq.options.map(o => darkRatio(g, loc.H, o.x, o.y, spec.sample, thr, streaks));
    return q;
  }
  // 自動判定。失敗時は ok:false と、見つかった隅の情報を返す
  function analyze(g, spec) {
    const white = paperWhite(g), streaks = findStreaks(g, white);
    const m = findMarkers(g, spec, white);
    const missing = m.map((p, i) => p ? null : ["左上", "右上", "左下", "右下"][i]).filter(Boolean);
    if (missing.length) return { ok: false, reason: "マークが見つからない（" + missing.join("・") + "）", markers: m };
    const loc = locateFrom(g, spec, m, white);
    if (!loc) return { ok: false, reason: "用紙の向きを判定できない", markers: m };
    return { ok: true, H: loc.H, flipped: loc.flipped, ratios: measure(g, spec, loc, white, streaks), streaks: streaks.cols.size + streaks.rows.size };
  }
  // 手動補正：ユーザーが画像上でクリックした4点（TL,TR,BL,BR）で判定
  function analyzeAt(g, spec, pts) {
    const white = paperWhite(g), streaks = findStreaks(g, white);
    const loc = locateFrom(g, spec, pts, white) || { H: homography(spec.markers, pts), flipped: false };
    return { ok: true, H: loc.H, flipped: loc.flipped, ratios: measure(g, spec, loc, white, streaks), manual: true };
  }
  // 手動補正のクリック位置を、近くの黒い四角の中心に吸着させる
  function snap(g, spec, x, y) {
    const ppm = g.w / spec.page.w, R = Math.round(8 * ppm), exp = spec.markerSize * ppm;
    const x0 = Math.max(0, Math.round(x - R)), y0 = Math.max(0, Math.round(y - R));
    const ww = Math.min(g.w, Math.round(x + R)) - x0, wh = Math.min(g.h, Math.round(y + R)) - y0;
    if (ww < 4 || wh < 4) return [x, y];
    const thr = Math.min(paperWhite(g) * 0.55, 150), bin = new Uint8Array(ww * wh);
    for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) bin[j * ww + i] = g.data[(y0 + j) * g.w + x0 + i] < thr ? 1 : 0;
    let best = null, bd = Infinity;
    for (const c of components(close(bin, ww, wh, Math.max(1, Math.round(0.9 * ppm))), ww, wh)) {
      const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
      if (bw < exp * 0.4 || bh < exp * 0.4 || bw > exp * 1.8 || bh > exp * 1.8) continue;
      const d = Math.hypot(x0 + c.cx - x, y0 + c.cy - y);
      if (d < bd) { bd = d; best = [x0 + c.cx, y0 + c.cy]; }
    }
    return best || [x, y];
  }
  function crop(g, H, r, ppmOut) {
    const w = Math.round(r.w * ppmOut), h = Math.round(r.h * ppmOut), data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [sx, sy] = apply(H, r.x + x / ppmOut, r.y + y / ppmOut);
      data[y * w + x] = px(g, sx, sy);
    }
    return { w, h, data };
  }
  return { analyze, analyzeAt, snap, classify, crop, paperWhite, findMarkers, findStreaks, homography, apply };
})();
if (typeof module !== "undefined") module.exports = OMR;
