# Bomb Defusal

Bomb Defusal is selectable on Dust II. The mode is signed into invitations; older links without a mode stay Deathmatch. Relay remains Deathmatch.

## Original reference behavior

Counter-Strike assigns the attacking side a single C4 device and provides two defended bombsites. The attackers win through detonation or eliminating defenders. Defenders win by preventing a plant until timeout, eliminating attackers before a plant, or defusing C4. A completed plant replaces the pre-plant clock with the bomb fuse.

References consulted:
- [Valve Developer Community: game modes](https://developer.valvesoftware.com/wiki/Counter-Strike:_Global_Offensive/Game_Modes)
- [Counter-Strike Wiki: C4](https://counterstrike.fandom.com/wiki/C4_Explosive)
- [Counter-Strike Wiki: Bomb Defusal](https://counterstrike.fandom.com/wiki/Bomb_Defusal)

## Team-specific sites

This game uses a symmetric variation: red can plant only at A and defends B;
blue can plant only at B and defends A. Each team has one independent C4 and
one carrier. Slot 5 selects your carried charge, held attack plants, and held E
defuses enemy C4 or recovers your team's dropped charge. The server validates
ownership and assigned site; the HUD and radar show both teams' objectives.
B’s plant zone includes the raised platform and its courtyard approach. Its
painted marker sits on clear platform ground, with placement and size defined
alongside the authoritative zone. Tests cover the full marker footprint.

Planting takes 3.2 seconds, each fuse lasts 40 seconds, and defusing takes
10 seconds. First detonation wins; exactly simultaneous detonations draw.
Defusing an enemy charge stops it without ending your own attack. Both charges
defused is a draw. Elimination wins only when the eliminated team's planted C4
is no longer a threat. Rounds have no time limit; planted charges retain their 40-second fuses.
Any planted fuse continues after the round clock expires. Detonation wins a
same-tick tie with defuse completion. Movement, release, invalid range/site,
death, disconnect or stale input cancels the action without retained progress.

## Scope

One life per active round; late joiners wait for the next round. Solo exploration/plant practice waits for an opponent before one-life elimination rules apply. The existing majority rematch vote starts a fresh single round with reset equipment and both C4 charges. There is no economy, kit purchase, competitive match series, side swapping or full spectator camera system. Existing friendly-fire settings and loadouts are retained. Bomb explosions can damage both teams nearby. C4 presentation continues for ten seconds through rising smoke and dust, with an 8.5-second audio tail. The result overlay waits 3.2 seconds; the server still resolves damage and the winner immediately. Grenades use a smaller four-second visual effect and a 3.2-second sound.

## Validation

Unit tests cover each team's assigned site, single-carrier ownership, wrong-site
rejection, cancellation, team-only recovery, enemy-only defusing, concurrent
plants/fuses, first and simultaneous detonations, elimination, unlimited rounds, rematch
reset, snapshot isolation and signed mode selection. A real two-client WebSocket
test plants both charges with held input, completes a ten-second enemy defuse,
and verifies that the remaining team's charge wins. Deathmatch and map safety
tests remain in place.
