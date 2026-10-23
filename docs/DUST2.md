# Dust II reconstruction

This is a hand-authored browser reconstruction based on the modern Dust II radar and visual references. It is not a Valve map export or a claim of exact dimensions. The internal map ID remains `dunes` to preserve signed invitations.

## References

- Valve's redesign presentation: https://www.counter-strike.net/dust2
- CS2 presentation: https://www.counter-strike.net/cs2
- Original designer's account: https://www.johnsto.co.uk/design/making-dust2/
- Community radar reference: https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/images/radars/de_dust2_radar_psd.png
- Radar calibration: https://raw.githubusercontent.com/MurkyYT/cs2-map-icons/main/data/radar_info/de_dust2.txt

The radar was consulted as a reference, not bundled as a game asset. Plan coordinates use 4.4 Source units per radar pixel and 0.0254 metres per unit. Heights, collision simplifications, props and architecture are authored approximations.

## Implemented

Long and its vestibule, Pit, A platform, Goose area, Short/Catwalk over the CT passage, Mid doors/Xbox, upper and lower tunnels, B doors/window/platform, and both spawns. Shared polygon and ramp definitions drive rendering, movement, hitscan occlusion and grenade collisions. Lobby scouting provides eight views; the in-game radar shows teammates and named areas.

## Validation

Six complete movement routes and ten former drop pockets are tested in both directions with actual movement integration. A directed surface-grid audit checks that sampled reachable positions have return paths. Rendered floors are clipped into a union so covered faces are removed, and 2,000 sampled rays check that visible tops agree with collision heights without duplicate faces. Tests also cover clear spawn/pickup positions, slope landing, stable ramp/landing seams, concave wall collisions, and passing above/below Short. Jump traversal tests cover low boxes, vehicle hoods/cabins, the B-window boost, CT boost steps, nearby cover leading to tall site stacks, and the new blue-container step. Vehicle collision follows the visible hood, cabin and truck bed; a normal jump rises about 1.69 m. The multiplayer suite exercises eight WebSocket clients, combat, respawn, reconnect and room recreation.

## Fidelity limits

This recreates the route structure and recognizable landmarks with procedural architecture and existing CC0 textures. It does not reproduce every Valve prop, material, clipping brush, grenade lineup, traversal timing or exact elevation. Stairs use smooth collision ramps. The map supports selectable Deathmatch and Bomb Defusal. A/B planting zones are defined in shared world coordinates and checked on the server; the original loadouts and manual round rematch remain.
