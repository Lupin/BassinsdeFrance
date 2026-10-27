from pathlib import Path
import base64
p=Path('outputs/au-fil-de-leau/dist');html=(p/'index.html').read_text();css=(p/'style.css').read_text();font=base64.b64encode((p/'assets/Inter.ttf').read_bytes()).decode();css=css.replace("url('assets/Inter.ttf')","url('data:font/ttf;base64,"+font+"')")
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>')
for name in ['data.js','admin.js','app.js']:
 html=html.replace('<script src="'+name+'"></script>','<script>'+(p/name).read_text().replace('</script','<\\/script')+'</script>')
html=html.replace('<script id="layers-data-lazy" data-src="layers-data.js"></script>','<script type="text/plain" id="layers-data-lazy">'+(p/'layers-data.js').read_text().replace('</script','<\\/script')+'</script>')
Path('outputs/carte-cours-eau-france.html').write_text(html)
assert 'src="data.js"' not in html and 'src="admin.js"' not in html
assert 'id="departments"' in html and 'id="prefectures"' in html
print('Version autonome à jour :',round(len(html.encode())/1e6,1),'Mo')
