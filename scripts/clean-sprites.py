"""Remove only border-connected neutral backgrounds from the supplied sheets."""
from PIL import Image
from collections import deque
from pathlib import Path
root = Path(__file__).resolve().parent.parent
for name, threshold in [('naruto', 235), ('sasuke', 170)]:
    im = Image.open(root / f'assets/{name}-sheet-original.jpg').convert('RGBA')
    w,h = im.size
    pixels = list(im.getdata())
    background = bytearray(w*h)
    eligible = bytearray(min(p[:3]) >= threshold and max(p[:3])-min(p[:3]) <= 22 for p in pixels)
    queue = deque()
    for y in range(h):
        for x in (0,w-1):
            i=y*w+x
            if eligible[i] and not background[i]: background[i]=1;queue.append(i)
    for x in range(w):
        for y in (0,h-1):
            i=y*w+x
            if eligible[i] and not background[i]: background[i]=1;queue.append(i)
    while queue:
        i=queue.popleft();x=i%w
        for j in ((i-1 if x else -1),(i+1 if x<w-1 else -1),i-w,i+w):
            if 0<=j<w*h and eligible[j] and not background[j]:
                background[j]=1;queue.append(j)
    im.putdata([(r,g,b,0 if background[i] else 255) for i,(r,g,b,a) in enumerate(pixels)])
    im.save(root / f'assets/{name}-sheet.png',optimize=True)
    print(name, 'transparent pixels:', sum(background), 'size:', im.size)
