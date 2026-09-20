"""Assemble tiny-rpg-town's CC0 artwork into an original SUBSTRATE prototype map.
Usage: python tools/build_assets.py /path/to/tiny-rpg-town-files.zip
Requires Pillow only for this optional one-time art build. Runtime has no dependencies.
"""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageDraw
from io import BytesIO
import sys, random

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'; OUT.mkdir(exist_ok=True)
PREFIX='tiny-rpg-town-files/Assets/Environments/Town/'
with ZipFile(sys.argv[1]) as z:
 def read(rel): return Image.open(BytesIO(z.read(PREFIX+rel))).convert('RGBA')
 atlas=read('tileset/tileset.png')
 example=read('tileset/example.png')
 grass=[read(f'tileset/grass-tile{suffix}.png') for suffix in ['', '-2','-3']]
 hero=read('spritesheets/hero.png'); npc=read('spritesheets/npc.png')
hero.save(OUT/'hero.png'); npc.save(OUT/'npc.png')
# cut from original transparent atlas; maintain natural tiny-pixel scale
BUILDINGS={
 'hall':(139,8,266,114),
 'cottage':(268,11,339,138),
 'trees':(72,14,138,122),
 'pond':(154,195,203,249),
 'stone':(0,149,47,192),
 'shrub':(16,97,61,126),
}
for name,box in BUILDINGS.items(): atlas.crop(box).save(OUT/(name+'.png'))
# Extract a single evergreen, with transparent surrounding pixels.
atlas.crop((76,16,98,122)).save(OUT/'pine.png')
RNG=random.Random(43)
W,H=768,576
base=Image.new('RGBA',(W,H),(111,152,66,255))
for yy in range(0,H,48):
 for xx in range(0,W,48):
  im=RNG.choice(grass)
  base.alpha_composite(im,(xx,yy))
d=ImageDraw.Draw(base,'RGBA')
# Crossroads, park, and edge-path are original map composition over free assets.
def road_rect(rect):
 d.rounded_rectangle(rect,radius=11,fill=(154,118,73,255))
 x1,y1,x2,y2=rect
 for _ in range(max(14,int((x2-x1)*(y2-y1)/370))):
  x=RNG.randrange(x1+2,x2-1);y=RNG.randrange(y1+2,y2-1)
  r=RNG.choice([1,1,2,3]);d.ellipse((x,y,x+r,y+r),fill=RNG.choice([(177,144,93,255),(192,159,107,255),(135,104,65,255)]))
road_rect((345,0,426,575));road_rect((0,272,767,353))
road_rect((85,245,688,380))
road_rect((200,115,282,430))
road_rect((520,130,597,420))
# Beige border and planted circular plaza from stylized sprite palette.
d.ellipse((277,201,492,414),fill=(93,132,74,255))
d.ellipse((296,217,474,398),fill=(198,177,128,255))
d.ellipse((304,225,466,390),fill=(158,127,84,255))
for _ in range(160):
 angle=RNG.random()*6.283; radius=RNG.random()*76
 import math
 x=int(385+math.cos(angle)*radius);y=int(307+math.sin(angle)*radius)
 if 308<x<462 and 229<y<387:
  r=RNG.choice([1,2,2]); d.ellipse((x,y,x+r,y+r),fill=RNG.choice([(181,145,92,255),(132,100,68,255),(203,169,119,255)]))
# A little plaza monument, symbolic rather than a false attribution to original asset.
d.ellipse((361,285,410,325),fill=(57,83,95,255))
d.ellipse((365,281,405,316),fill=(105,143,152,255))
d.polygon([(375,283),(395,283),(404,303),(367,303)],fill=(165,193,187,255))
d.ellipse((380,262,392,287),fill=(121,174,190,255))
d.ellipse((383,265,389,274),fill=(224,234,211,255))
# Add original pack's crisp sprites on their own graphic layer.
base.alpha_composite(atlas.crop(BUILDINGS['hall']),(296,27))
base.alpha_composite(atlas.crop(BUILDINGS['hall']),(94,136))
base.alpha_composite(atlas.crop(BUILDINGS['cottage']),(574,133))
base.alpha_composite(atlas.crop(BUILDINGS['cottage']),(87,371))
base.alpha_composite(atlas.crop(BUILDINGS['cottage']),(582,370))
for x,y in [(24,19),(74,21),(660,20),(714,22),(18,159),(715,162),(12,400),(720,415),(260,27),(477,26),(246,455),(490,460),(31,496),(688,498)]:
 base.alpha_composite(atlas.crop((76,16,98,122)),(x,y))
for x,y in [(59,267),(94,333),(623,267),(674,332),(275,214),(480,220),(288,397),(471,393),(189,342),(539,349)]:
 d=ImageDraw.Draw(base);d.ellipse((x,y,x+8,y+5),fill=(49,97,56,255));d.ellipse((x+2,y-2,x+8,y+2),fill=(95,140,60,255))
# Open south gate: visual markers and sign use ordinary UI labels at runtime.
d=ImageDraw.Draw(base);d.rectangle((343,536,428,559),fill=(159,124,76,255))
d.rectangle((359,543,413,548),fill=(206,171,115,255))
base.convert('RGB').save(OUT/'town.png',optimize=True)
# Overworld: miniature desktop-as-town, a continuous test map with surrounding terrain.
OW,OH=768,576
world=Image.new('RGBA',(OW,OH),(107,153,78,255));dw=ImageDraw.Draw(world)
for yy in range(0,OH,48):
 for xx in range(0,OW,48): world.alpha_composite(RNG.choice(grass),(xx,yy))
dw=ImageDraw.Draw(world)
# coastline and lakes create visible sense of wider territory; ship comes later
for xx in range(OW):
 y=int(91+12*__import__('math').sin(xx/42)+9*__import__('math').sin(xx/15))
 dw.line((xx,0,xx,y),fill=(49,111,133,255))
 dw.point((xx,y+1),fill=(220,208,147,255))
dw.ellipse((586,377,744,534),fill=(59,123,145,255));dw.ellipse((612,395,717,506),fill=(70,135,150,255))
# world roads and village footprints
road_rect_backup=road_rect
# draw instead using overworld drawing object
for box in [(74,238,687,253),(230,164,252,500),(517,166,539,490)]:dw.rounded_rectangle(box,radius=6,fill=(163,128,84,255))
# small town silhouettes based on same actual town buildings
for name,x,y in [('hall',172,179),('cottage',254,190),('hall',464,188),('cottage',549,187)]:
 im=atlas.crop(BUILDINGS[name]);im.thumbnail((72,68),Image.Resampling.NEAREST);world.alpha_composite(im,(x,y))
for x,y in [(47,141),(80,290),(115,411),(303,150),(354,450),(640,283),(690,352),(708,464),(409,91),(36,484),(477,423)]:
 im=atlas.crop((76,16,98,122));im.thumbnail((16,53),Image.Resampling.NEAREST);world.alpha_composite(im,(x,y))
for x,y in [(167,269),(244,255),(499,269),(569,256)]:
 dw=ImageDraw.Draw(world);dw.ellipse((x,y,x+9,y+6),fill=(59,112,67,255))
world.convert('RGB').save(OUT/'overworld.png',optimize=True)
print('Built',', '.join(p.name for p in OUT.glob('*.png')))
