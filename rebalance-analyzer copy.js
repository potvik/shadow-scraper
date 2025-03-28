const fs = require('fs');

// Загрузим данные
const rawData = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const pool = rawData.data.clPool;

function parseEvents(events) {
  return events.map(e => ({
    owner: e.owner,
    tickLower: parseInt(e.tickLower),
    tickUpper: parseInt(e.tickUpper),
    timestamp: parseInt(e.timestamp),
  }));
}

function matchRebalances(mints, burns, timeWindow = 3600) {
  let rebalanceCount = 0;
  const burnsByOwner = {};

  // Группировка burns по owner
  for (const burn of burns) {
    if (!burnsByOwner[burn.owner]) burnsByOwner[burn.owner] = [];
    burnsByOwner[burn.owner].push(burn);
  }

  // Попытка найти для каждого mint подходящий burn
  for (const mint of mints) {
    const userBurns = burnsByOwner[mint.owner] || [];

    const matchIndex = userBurns.findIndex(burn =>
      Math.abs(mint.timestamp - burn.timestamp) < timeWindow &&
      (mint.tickLower !== burn.tickLower || mint.tickUpper !== burn.tickUpper)
    );

    if (matchIndex !== -1) {
      rebalanceCount++;
      // Удаляем использованный burn
      userBurns.splice(matchIndex, 1);
    }
  }

  return rebalanceCount;
}

const mints = parseEvents(pool.mints);
const burns = parseEvents(pool.burns);

const rebalances = matchRebalances(mints, burns);

console.log(`📊 Pool tickSpacing=${pool.tickSpacing}, tick=${pool.tick}`);
console.log(`→ Total mints: ${mints.length}`);
console.log(`→ Total burns: ${burns.length}`);
console.log(`🔁 Estimated rebalances: ${rebalances}`);
console.log('---');
