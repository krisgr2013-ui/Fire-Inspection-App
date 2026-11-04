from html.parser import HTMLParser
from pathlib import Path
import re, subprocess, tempfile

class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = []
        self.scripts = []
        self.in_script = False
        self.current_script = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        ident = attrs.get('id')
        if ident:
            if ident in self.ids: self.duplicates.append(ident)
            self.ids.add(ident)
        if tag == 'script' and 'src' not in attrs:
            self.in_script = True
            self.current_script = []
    def handle_endtag(self, tag):
        if tag == 'script' and self.in_script:
            self.scripts.append(''.join(self.current_script))
            self.in_script = False
    def handle_data(self, data):
        if self.in_script: self.current_script.append(data)

source = Path('gold-standard-v2.html').read_text(encoding='utf-8')
parser = Checker()
parser.feed(source)
parser.close()
if parser.duplicates:
    raise SystemExit('Duplicate HTML ids: ' + ', '.join(parser.duplicates))
if not parser.scripts:
    raise SystemExit('No inline application script found')
with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as handle:
    handle.write('\n;\n'.join(parser.scripts))
    js_path = handle.name
result = subprocess.run(['node', '--check', js_path], text=True, capture_output=True)
if result.returncode:
    print(result.stdout)
    print(result.stderr)
    raise SystemExit(result.returncode)
print(f'HTML parsed; {len(parser.ids)} unique IDs; {len(parser.scripts)} inline script(s) pass Node syntax check.')
