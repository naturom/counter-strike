import * as React from 'react';
import {TEAMS,type Player} from '@sirocco/shared';
export function SpectatorHud({player}:{player:Player}){
  return <aside className="spectator-banner" role="status" aria-live="polite">
    <span>YOU DIED · VIEW ONLY</span>
    <strong className={`team-${player.team}`}>{player.name}</strong>
    <small>{TEAMS[player.team].name.toUpperCase()} · <kbd>SPACE</kbd> NEXT PLAYER</small>
  </aside>;
}
