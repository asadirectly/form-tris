// every achievement and rank lives in this file, add a new one by adding a line to the list
//
// mode says where it can be earned: 'any', 'normal', 'sprint', 'multi', or a list of modes like ['normal', 'sprint']
// test(stats, result) runs on the server after a finished round or match, but only in the modes listed
// stats is the player's saved totals (already updated with this game), result is the game that just ended
// icon is the short text on the colored tile, color is a piece color from theme.css

const SOLO = ['normal', 'sprint'];

export const ACHIEVEMENTS = [
  // any mode
  { id: 'first-drop', name: 'First Drop', text: 'Finish your first round or match.', icon: '1', color: 'cyan', mode: 'any', test: (s) => s.rounds >= 1 },
  { id: 'lines-10', name: 'Warm-Up', text: 'Clear 10 lines in total.', icon: '10', color: 'cyan', mode: 'any', test: (s) => s.lines >= 10 },
  { id: 'lines-100', name: 'Century', text: 'Clear 100 lines in total.', icon: '100', color: 'blue', mode: 'any', test: (s) => s.lines >= 100 },
  { id: 'lines-1000', name: 'Line Machine', text: 'Clear 1,000 lines in total.', icon: 'K', color: 'purple', mode: 'any', test: (s) => s.lines >= 1000 },
  { id: 'rounds-50', name: 'Regular', text: 'Finish 50 rounds or matches.', icon: '50', color: 'green', mode: 'any', test: (s) => s.rounds >= 50 },
  { id: 'hour', name: 'Hour of Power', text: 'Play for one hour in total.', icon: '1H', color: 'orange', mode: 'any', test: (s) => s.playMs >= 60 * 60 * 1000 },

  // normal mode
  { id: 'score-5k', name: 'Getting Warm', text: 'Score 5,000 in a Normal round.', icon: '5K', color: 'blue', mode: 'normal', test: (s, r) => r.score >= 5000 },
  { id: 'score-25k', name: 'Stacking Up', text: 'Score 25,000 in a Normal round.', icon: '25K', color: 'blue', mode: 'normal', test: (s, r) => r.score >= 25000 },
  { id: 'score-100k', name: 'Six Figures', text: 'Score 100,000 in a Normal round.', icon: '1M', color: 'yellow', mode: 'normal', test: (s, r) => r.score >= 100000 },
  { id: 'level-5', name: 'Speeding Up', text: 'Reach level 5 in Normal.', icon: 'L5', color: 'green', mode: 'normal', test: (s, r) => r.level >= 5 },
  { id: 'level-10', name: 'Hot Hands', text: 'Reach level 10 in Normal.', icon: 'L10', color: 'red', mode: 'normal', test: (s, r) => r.level >= 10 },

  // line clears, normal and 40L
  { id: 'tetris', name: 'Tetris!', text: 'Clear four lines at once.', icon: 'I', color: 'cyan', mode: SOLO, test: (s, r) => r.tetrises >= 1 },
  { id: 'tspin', name: 'Spin Doctor', text: 'Clear lines with a T-spin.', icon: 'T', color: 'purple', mode: SOLO, test: (s, r) => r.tspins >= 1 },
  { id: 'tspin-10', name: 'Spin Cycle', text: 'Clear lines with 10 T-spins in total.', icon: 'T10', color: 'purple', mode: SOLO, test: (s) => s.tspins >= 10 },
  { id: 'combo-5', name: 'Chain Reaction', text: 'Reach a x5 combo.', icon: 'x5', color: 'orange', mode: SOLO, test: (s, r) => r.combo >= 5 },
  { id: 'perfect', name: 'Spotless', text: 'Clear the whole board.', icon: 'PC', color: 'yellow', mode: SOLO, test: (s, r) => r.perfects >= 1 },

  // 40L
  { id: 'sprint-done', name: 'Forty Down', text: 'Finish a 40L race.', icon: '40', color: 'orange', mode: 'sprint', test: (s, r) => r.won },
  { id: 'sprint-2min', name: 'Under Two', text: 'Finish 40L in under 2:00.', icon: '2:00', color: 'orange', mode: 'sprint', test: (s, r) => r.won && r.time < 120000 },
  { id: 'sprint-1min', name: 'Speed Demon', text: 'Finish 40L in under 1:00.', icon: '1:00', color: 'red', mode: 'sprint', test: (s, r) => r.won && r.time < 60000 },

  // multiplayer, a match only counts when it lasted a minute or more
  { id: 'multi-play', name: 'Join the Pile', text: 'Play a multiplayer match.', icon: 'VS', color: 'red', mode: 'multi', test: (s) => s.matches >= 1 },
  { id: 'multi-win', name: 'Last One Standing', text: 'Win a multiplayer match.', icon: 'W', color: 'yellow', mode: 'multi', test: (s, r) => r.placement === 1 },
  { id: 'multi-wins-10', name: 'Veteran', text: 'Win 10 multiplayer matches.', icon: 'W10', color: 'yellow', mode: 'multi', test: (s) => s.matchWins >= 10 },
  { id: 'multi-ko', name: 'Lights Out', text: 'Knock out another player.', icon: 'KO', color: 'red', mode: 'multi', test: (s) => s.kos >= 1 },
  { id: 'multi-ko-5', name: 'Knockout Artist', text: 'Knock out 5 players in total.', icon: 'K5', color: 'red', mode: 'multi', test: (s) => s.kos >= 5 },
  { id: 'royale-win', name: 'Crowned', text: 'Win a Battle Royale with 10 or more players.', icon: 'BR', color: 'purple', mode: 'multi', test: (s, r) => r.kind === 'royale' && r.size >= 10 && r.placement === 1 },
  { id: 'garbage-100', name: 'Garbage Collector', text: 'Send 100 garbage lines in total.', icon: 'G', color: 'green', mode: 'multi', test: (s) => s.sent >= 100 },
];

// ranks come from how many achievements a player has. owner and admin are separate, they are given by the server's settings
export const RANKS = [
  { id: 'blockhead', name: 'Blockhead', need: 1, color: 'cyan' },
  { id: 'stackademic', name: 'Stackademic', need: 5, color: 'green' },
  { id: 'tetrific', name: 'Tetrific', need: 10, color: 'purple' },
  { id: 'grandstacker', name: 'GrandStacker', need: 15, color: 'yellow' },
];

export const MAX_SHOWN_RANKS = 2; // how many earned ranks a player can show next to their name

// the ranks a player has earned, lowest first
export function earnedRanks(achievementCount) {
  return RANKS.filter((rank) => achievementCount >= rank.need);
}
