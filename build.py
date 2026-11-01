#!/usr/bin/env python3
"""小羊樂園建置：src/index.src.html → index.html
把主程式轉成舊瀏覽器（含三星電視）看得懂的寫法。
用法：python3 build.py <babel 所在的 node 專案資料夾>"""
import re, subprocess, sys, pathlib
root=pathlib.Path(__file__).parent
babel_dir=pathlib.Path(sys.argv[1])
src=(root/'src/index.src.html').read_text()
m=re.search(r'(<script>\n/\* =+ 資料層.*?)(</script>)',src,re.S)
js=m.group(1)[len('<script>\n'):]
POLY=r'''if(!Array.prototype.flatMap){Array.prototype.flatMap=function(f,t){return Array.prototype.concat.apply([],this.map(f,t))}}
if(!String.prototype.padStart){String.prototype.padStart=function(n,c){var s=String(this);c=c||' ';while(s.length<n)s=c+s;return s.slice(-Math.max(n,String(this).length))}}
if(!Object.entries){Object.entries=function(o){return Object.keys(o).map(function(k){return[k,o[k]]})}}
if(window.NodeList&&!NodeList.prototype.forEach){NodeList.prototype.forEach=Array.prototype.forEach}
'''
tmp=babel_dir/'in.js';tmp.write_text(js)
cfg=babel_dir/'babel.config.json'
cfg.write_text('{"presets":[["@babel/preset-env",{"targets":{"chrome":"47"},"exclude":["transform-regenerator"],"modules":false}]]}')
out=subprocess.run(['npx','babel','in.js'],cwd=babel_dir,capture_output=True,text=True)
if out.returncode: print(out.stderr); sys.exit(1)
html=src[:m.start()]+'<script>\n'+POLY+out.stdout+'\n</script>'+src[m.end():]
# ---- CSS 相容：舊瀏覽器不支援顏色變數、8 位色碼、grid、flex gap ----
def hex2rgba(m):
    h=m.group(1)
    if len(h)==4: h=''.join(c*2 for c in h)
    r,g,b,a=(int(h[i:i+2],16) for i in (0,2,4,6))
    return 'rgba(%d,%d,%d,%.2f)'%(r,g,b,a/255)
def fix_css(css):
    vars=dict(re.findall(r'(--[\w-]+):([^;}]+)',re.search(r':root\{([^}]*)\}',css).group(1)))
    css=re.sub(r'var\((--[\w-]+)\)',lambda m:vars[m.group(1)].strip(),css)
    css=re.sub(r'#([0-9a-fA-F]{8}|[0-9a-fA-F]{4})(?![0-9a-fA-F])',hex2rgba,css)
    return css+"""
@supports not (display:grid){.kids,.grid{display:flex;flex-wrap:wrap}.kid{width:6.5em;margin:.2em}}
@supports not (gap:1px){.row>*,.items>*,.btns>*,.checks>*,.who>*,nav>*,.actions>*{margin:3px}}
"""
html=re.sub(r'<style>(.*?)</style>',lambda m:'<style>'+fix_css(m.group(1))+'</style>',html,count=1,flags=re.S)
# 內嵌 style 屬性與程式裡的 var()
html=html.replace("var(--ok)","#2e9b5a").replace("var(--blue)","#2a6fd6").replace("var(--warn)","#c9711c").replace("var(--line)","#e6ddd0")
(root/'index.html').write_text(html)
print('index.html 建置完成', len(html)//1024, 'KB')
