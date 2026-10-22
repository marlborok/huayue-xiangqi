"""花月象棋 — generate the expression and grown-up-pawn pictures with Gemini image editing.

Each new picture is made from that character's original illustration (in 花之國/ or 月之國/) as the reference,
with the prompts from docs/表情與成長繪圖提示詞.md, and saved next to it as e.g. 花之國/flower-K-worry.png.
Pictures that already exist are skipped, so a run can be repeated or resumed.

The API key is read from GEMINI_API_KEY in the environment or in .env at the repository root
(.env is git-ignored). The key is only sent in the request header and is never printed.

    python tools/gemini_variants.py --test            # one picture, to check the key and the free quota
    python tools/gemini_variants.py                   # all 30
    python tools/gemini_variants.py --only flower-K-worry moon-P-up
"""
import argparse, base64, os, sys, time
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent.parent
FOLDER = {'flower': ROOT / '花之國', 'moon': ROOT / '月之國'}
CHAR = {'flower': dict(zip('KABRNCP', '帥仕相俥傌炮兵')), 'moon': dict(zip('KABRNCP', '將士象車馬包卒'))}
MODEL = 'gemini-2.5-flash-image'
API = 'https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent'

COMMON = ('Same character, same outfit, same art style, same proportions and same pose as the reference image. '
          "Children's picture-book illustration, soft watercolor and colored pencil, plain flat white background, "
          'full body, nothing cropped, no ground, no text. Only change the facial expression and a small gesture: ')
MOOD = {
    'worry': 'worried and a little scared: eyebrows raised, small open mouth, eyes looking to the side, '
             'hands held close to her chest, a single small sweat drop.',
    'happy': 'proud and delighted: big bright smile with closed happy eyes, rosy cheeks, one hand raised in a little cheer or victory pose.',
}
GROWN = {
    'flower': ('Same character, same art style and proportions as the reference image. Children\'s picture-book illustration, soft watercolor '
               'and colored pencil, plain flat white background, full body, nothing cropped, no ground, no text. '
               'The same little flower fairy, now grown braver after crossing the river: a bigger crown of blooming flowers, '
               'a small pink cape, holding her flower staff up high, confident smile.'),
    'moon': ('Same character, same art style and proportions as the reference image. Children\'s picture-book illustration, soft watercolor '
             'and colored pencil, plain flat white background, full body, nothing cropped, no ground, no text. '
             'The same little star sprite, now grown braver after crossing the river: a glowing star tiara, '
             'a small lavender cape with stars, holding a star wand up high, confident smile.'),
}
FIRST = ['flower-K-worry', 'moon-K-worry', 'flower-K-happy', 'moon-K-happy', 'flower-P-up', 'moon-P-up', 'flower-R-happy', 'moon-R-happy']


def all_names():
    names = list(FIRST)
    for side in ('flower', 'moon'):
        for t in 'KABRNCP':
            for mood in ('worry', 'happy'):
                n = f'{side}-{t}-{mood}'
                if n not in names: names.append(n)
    return names


def api_key():
    k = os.environ.get('GEMINI_API_KEY')
    env = ROOT / '.env'
    if not k and env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            if line.strip().startswith('GEMINI_API_KEY='):
                k = line.split('=', 1)[1].strip().strip('"').strip("'")
    if not k: sys.exit('找不到 GEMINI_API_KEY：請在專案根目錄的 .env 寫一行 GEMINI_API_KEY=你的金鑰')
    return k


def reference(side, t):
    hits = [p for p in FOLDER[side].glob('*.jpg') if p.name.startswith(CHAR[side][t])]
    if not hits: raise FileNotFoundError(f'{FOLDER[side].name}/ 裡找不到「{CHAR[side][t]}」開頭的原圖')
    return hits[0]


def generate(name, key, model):
    side, t, kind = name.split('-')
    prompt = GROWN[side] if kind == 'up' else COMMON + MOOD[kind]
    ref = reference(side, t)
    body = {'contents': [{'parts': [
        {'inline_data': {'mime_type': 'image/jpeg', 'data': base64.b64encode(ref.read_bytes()).decode()}},
        {'text': prompt}]}],
        'generationConfig': {'responseModalities': ['IMAGE']}}
    for attempt in range(4):
        r = requests.post(API.format(model), json=body, headers={'x-goog-api-key': key}, timeout=180)
        if r.status_code == 429 or r.status_code >= 500:
            msg = r.json().get('error', {}).get('message', '') if r.headers.get('content-type', '').startswith('application/json') else ''
            if 'limit: 0' in msg: raise RuntimeError(f'HTTP 429 quota：這個模型的免費額度是 0，需要在 Google AI Studio 綁定付款才能產圖。 Google 的說明：{msg[:400]}')
            wait = 20 * (attempt + 1); print(f'  {r.status_code}，{wait} 秒後重試… {msg[:200]}'); time.sleep(wait); continue
        if r.status_code != 200:
            msg = r.json().get('error', {}).get('message', r.text[:300]) if r.headers.get('content-type', '').startswith('application/json') else r.text[:300]
            raise RuntimeError(f'HTTP {r.status_code}：{msg}')
        for cand in r.json().get('candidates', []):
            for part in cand.get('content', {}).get('parts', []):
                data = part.get('inline_data') or part.get('inlineData')
                if data:
                    out = FOLDER[side] / f'{name}.png'
                    out.write_bytes(base64.b64decode(data['data']))
                    return out
        raise RuntimeError('回應裡沒有圖片（可能被安全過濾或模型只回了文字）')
    raise RuntimeError('重試多次仍失敗（額度用完或伺服器忙碌）')


def main():
    sys.stdout.reconfigure(encoding='utf-8')   # Windows consoles default to cp950
    ap = argparse.ArgumentParser()
    ap.add_argument('--test', action='store_true', help='只產第一張，確認金鑰與額度')
    ap.add_argument('--only', nargs='*', help='只產這些，例如 flower-K-worry')
    ap.add_argument('--model', default=MODEL)
    a = ap.parse_args()
    key = api_key()
    names = a.only or all_names()
    if a.test: names = names[:1]
    done = fail = 0
    for n in names:
        side = n.split('-')[0]
        if (FOLDER[side] / f'{n}.png').exists(): print(f'{n}：已存在，略過'); continue
        print(f'{n}：產生中…', flush=True)
        try:
            out = generate(n, key, a.model); done += 1; print(f'  → {out.relative_to(ROOT)}')
        except Exception as e:
            fail += 1; print(f'  ✗ {e}')
            if 'billing' in str(e).lower() or 'quota' in str(e).lower(): print('  額度或付款設定的問題，先停下來。'); break
        time.sleep(4)   # stay well under the per-minute limit
    print(f'完成 {done} 張，失敗 {fail} 張')


if __name__ == '__main__':
    main()
