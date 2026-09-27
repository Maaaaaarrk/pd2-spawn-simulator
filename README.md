# pd2-spawn-simulator
Experimental PD2 map population, monster density, XP and rarity simulator.

## Patching the build

`simulator.bin` is a gzipped single-page build. The site look (stone and gold theme), the shared site nav and the
boss/entrance map markers are applied on top of an unpatched build by `patch/patch.py`:

```
python patch/patch.py              # re-patch the last unpatched build (simulator.bin at cba29b1)
python patch/patch.py new.bin      # patch a fresh build from the simulator source
```

It writes `simulator.bin` and bumps the `?v=` version in `index.html`. Every replacement must match exactly, so a
build that changed underneath it stops with an error instead of half-applying.

Boss and entrance positions come from each layout's DS1 presets. The clear route is drawn on that same map:
a walking line from the entrance through the connected corridors to the boss. To regenerate `patch/markers.json`
(needs the installed PD2 data and the map_compare tools; paths are at the top of the script):

```
python patch/markers.py [new.bin]
```
