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
(root/'index.html').write_text(html)
print('index.html 建置完成', len(html)//1024, 'KB')
