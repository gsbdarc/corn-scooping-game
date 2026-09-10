from urllib.request import urlopen, urlretrieve
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
import json
base='https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/master/'
project=Path(__file__).resolve().parent.parent
root=project/'public/assets/people'; root.mkdir(parents=True,exist_ok=True)
references=project/'references'; references.mkdir(parents=True,exist_ok=True)
manifest=references/'rocketbox-tree.json'
if not manifest.exists():
 with urlopen('https://api.github.com/repos/microsoft/Microsoft-Rocketbox/git/trees/master?recursive=1') as response:
  manifest.write_bytes(response.read())
with manifest.open() as source:
 tree=json.load(source)['tree']
names=['Female_Adult_05','Female_Adult_08','Male_Adult_01']
paths=[]
for name in names:
 for a in tree:
  p=a['path']
  if p.startswith('Assets/Avatars/Adults/'+name+'/') and (p.endswith('/'+name+'.fbx') or (p.endswith('_color.tga'))): paths.append(p)
paths+=['Assets/Animations/all_animations_max_motextr_static/f_idle_breathe_01.max.fbx','Assets/Animations/all_animations_max_motextr_static/m_idle_breathe_01.max.fbx','LICENSE.md']
def get(p):
 filename=p.split('/')[-1]
 if filename=='LICENSE.md': target=root/'LICENSE-Rocketbox.md'
 else: target=root/filename
 if filename.endswith('.tga'):
  tmp=references/filename
  urlretrieve(base+p,tmp)
  im=Image.open(tmp); im.thumbnail((1024,1024)); target=root/(filename[:-4]+'.webp')
  im.save(target,quality=90,method=6)
  tmp.unlink()
 else: urlretrieve(base+p,target)
 print(target,flush=True)
with ThreadPoolExecutor(max_workers=5) as pool: list(pool.map(get,paths))
