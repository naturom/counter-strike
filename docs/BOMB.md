# Bomb Defusal

Bomb Defusal is selectable on Dust II. The mode is signed into invitations; older links without a mode stay Deathmatch. Relay remains Deathmatch.

## Reference behavior

Counter-Strike assigns the attacking side a single C4 device and provides two defended bombsites. The attackers win through detonation or eliminating defenders. Defenders win by preventing a plant until timeout, eliminating attackers before a plant, or defusing C4. A completed plant replaces the pre-plant clock with the bomb fuse.

References consulted:
- [Valve Developer Community: game modes](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive/Game_Modes)
- [Counter-Strike Wiki: C4](https://counterstrike.fandom.com/wiki/C4_Explosive)
- [Counter-Strike Wiki: Bomb Defusal](https://counterstrike.fandom.com/wiki/Bomb_Defusal)

This implementation uses 3.2 seconds to plant, a 40-second fuse, a 10-second defuse without a kit, and a 115-second pre-plant round. Red attacks and blue defends A/B. Slot 5 selects carried C4, held attack plants, and held E defuses. A dropped C4 is recovered by a red teammate with E. Movement, release, invalid range/site, death, disconnect or stale input cancels the relevant action. Progress is not retained after cancellation. The server arbitrates simultaneous actions and detonation wins an exact-tick tie with defuse completion.

## Scope

One life per active round; late joiners wait for the next round. Solo exploration/plant practice waits for an opponent before the pre-plant clock runs. The existing majority rematch vote starts a fresh single round with reset equipment and C4. There is no economy, kit purchase, competitive match series, side swapping or full spectator camera system. Existing friendly-fire settings and loadouts are retained. Bomb explosions can damage both teams nearby. C4 presentation continues for ten seconds through rising smoke and dust, with an 8.5-second audio tail. The result overlay waits 3.2 seconds; the server still resolves damage and the winner immediately. Grenades use a smaller four-second visual effect and a 3.2-second sound.

## Validation

Unit tests cover A/B planting, carrier ownership, invalid planting, action cancellation, drop/recovery, distance/cover checks, one life, elimination, pre/post-plant time rules, fuse/defuse ties, rematch reset and signed mode selection. A real WebSocket integration test joins two clients, binds the invitation's mode, plants with held input and completes a ten-second defuse. The existing Deathmatch and map safety tests are retained.
