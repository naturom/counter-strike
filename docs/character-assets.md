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

Iron Man, Ultraman and Wonder Woman's equipped arms use the same anatomical surface and
original skin weights, including their deltoids, elbow contours and forearm taper.
`node scripts/build-character-assets.mjs <source-folder> --arms-only` regenerates
`character-arm-data.json` without changing the other character assets. The runtime
pins the original torso boundary, poses the upper arm, forearm and wrist, and
keeps glove contacts attached during equipment actions. Iron Man retains segmented
metal colours. Torso and thigh panels are thin closed shells clipped from the
anatomical surface, with an inset reactor and small machined seams. Leg panels
share the thigh transform so they remain fitted while moving. Wonder Woman uses the textured skin and fitted wrist bracers.

`avatar-motion.ts` updates the actual world body before the reflection camera
renders. Local gait and crouching follow predicted movement; equipment sway, aim
and reload poses rebase the shoulder anchors each frame so the torso seams stay
attached. Mirrors and other players render that same posed model.

Jump/crouch animation keeps a full-size torso, head and hands together above
articulated thighs, knees and ankles. The pelvis lowers for crouching while the
feet remain planted; airborne poses tuck the legs and landing bends the knees.
Arm/hip seams follow the torso and Wonder Woman's skirt follows the thighs.
`StanceMotion` also drives restrained first-person hand movement, respecting
reduced-motion preferences. Movement collision, camera eye heights and damage
rules continue to use the shared gameplay model.

First-person arms use a separate radial fit around those same anatomical bone
axes, with fuller forearms and a gradual taper into the unchanged glove cuffs.
This camera-specific fit does not change the full-body or mirror proportions.
All weapon views share machined receivers, textured grips, detailed controls and
optics: the first-person gun, mirrored/remote player gun and pickups build the
same complete design and reuse the same finish and lens materials, including a
visible full-length shoulder stock. First-person framing keeps the barrel aimed
along the crosshair, and muzzle sockets attach flashes/tracers to the actual gun. Static detail
is batched by material, while magazines, pistol slides and sniper bolts remain
separate for their reload/firing animations.

Geometry is synchronous and shared through the browser bundle; textures load from
this game's origin. Male/female anatomy and open/closed hands retain the existing
player size, weapon transforms and movement controls. Meshes stay on the same team
and damage rules. Profile previews and spawn reflections use the same bodies.

These are higher-detail real-time character interpretations, not scanned actors
or film-production assets. Costume details still vary in fidelity by character.
