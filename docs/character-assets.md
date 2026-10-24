# Character appearance assets

The anatomical bodies, eyes, skin textures and three hair styles come from the
CC0 MakeHuman assets exported by [CharacterCreator](https://github.com/kblood/CharacterCreator).
The pinned commit and asset-specific declarations are shipped in
`apps/web/public/models/CREDITS.txt` and `characters/source-asset-licenses.json`.
Only exported CC0 assets are used; the upstream application code is not included.
Costumes, armor, surface maps and posing/compaction code are authored in this repo.

`scripts/build-character-assets.mjs` reads these upstream exports from its input
folder: `base_body.glb`, `base_body.joints.json`, `hair_long01.glb`,
`hair_bob02.glb`, and `hair_short02.glb`. It poses and compacts the meshes into
`character-anatomy-data.json` and extracts textures to the public models directory.
Run `node scripts/build-character-assets.mjs <source-folder>` to regenerate them.
No Blender installation or runtime connection to the upstream repository is needed.

Geometry is synchronous and shared through the browser bundle; textures load from
this game's origin. Male/female anatomy and open/closed hands retain the existing
player size, weapon transforms and movement controls. Meshes stay on the same team
and damage rules. Profile previews and spawn reflections use the same bodies.

These are higher-detail real-time character interpretations, not scanned actors
or film-production assets. Costume details still vary in fidelity by character.
