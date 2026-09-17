import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createLeaderboardStore } from '../src/leaderboard/server.js';

const [command = 'list', argument = ''] = process.argv.slice(2);
const filePath = process.env.LEADERBOARD_FILE || resolve('data', 'leaderboard.json');
const store = createLeaderboardStore(filePath);

if (command === 'list') {
  const query = argument.toLocaleLowerCase();
  const entries = await store.list({}, 100);
  const matches = entries.filter(entry => !query || entry.username.toLocaleLowerCase().includes(query) || entry.id === argument);
  if (!matches.length) {
    console.log('No matching leaderboard entries.');
  } else {
    console.table(matches.map(entry => ({
      id: entry.id,
      username: entry.username,
      scenario: entry.scenario,
      seed: entry.seed,
      deaths: entry.summary.systemDeaths,
      score: entry.score,
      submittedAt: entry.submittedAt,
    })));
  }
} else if (command === 'remove') {
  if (!/^[a-f0-9]{24}$/.test(argument)) throw new Error('Usage: npm run leaderboard:moderate -- remove <24-character entry id>');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup-${stamp}`;
  await copyFile(filePath, backupPath);
  const removed = await store.remove(argument);
  if (!removed) throw new Error(`Entry ${argument} was not found. Backup retained at ${backupPath}`);
  console.log(`Removed ${removed.username} (${removed.id}). Backup: ${backupPath}`);
} else {
  throw new Error('Usage: npm run leaderboard:moderate -- [list [name-or-id] | remove <id>]');
}
