const fs = require('fs');

// === 1. Загрузка JSON-файла ===
const rawData = fs.readFileSync('data.json');
const data = JSON.parse(rawData);

// === 2. Вспомогательные функции ===
function toDate(timestamp) {
  return new Date(parseInt(timestamp) * 1000);
}

function rangeKey(tickLower, tickUpper) {
  return `${tickLower}_${tickUpper}`;
}

// === 3. Подготовка данных ===
const mints = data.data.clPool.mints.map(m => ({
  type: 'mint',
  owner: m.owner,
  tickLower: parseInt(m.tickLower),
  tickUpper: parseInt(m.tickUpper),
  timestamp: toDate(m.timestamp),
  amount0: parseFloat(m.amount0),
  amount1: parseFloat(m.amount1),
}));

const burns = data.data.clPool.burns.map(b => ({
  type: 'burn',
  owner: b.owner,
  tickLower: parseInt(b.tickLower),
  tickUpper: parseInt(b.tickUpper),
  timestamp: toDate(b.timestamp),
  amount0: parseFloat(b.amount0),
  amount1: parseFloat(b.amount1),
}));

const combined = [...mints, ...burns].sort((a, b) =>
  a.owner === b.owner ? a.timestamp - b.timestamp : a.owner.localeCompare(b.owner)
);

// === 4. Поиск ребалансов и прибыли ===
const rebalances = [];

for (let i = 0; i < combined.length - 1; i++) {
  const current = combined[i];
  const next = combined[i + 1];

  // Условие ребаланса
  if (
    current.type === 'burn' &&
    next.type === 'mint' &&
    current.owner === next.owner &&
    (current.tickLower !== next.tickLower || current.tickUpper !== next.tickUpper) &&
    (next.timestamp - current.timestamp) / (1000 * 60) < 360 // меньше 6 часов
  ) {
    // Найти предыдущее mint для current диапазона
    const lastMint = mints
      .filter(m =>
        m.owner === current.owner &&
        m.tickLower === current.tickLower &&
        m.tickUpper === current.tickUpper &&
        m.timestamp < current.timestamp
      )
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (!lastMint) continue;

    const delta0 = current.amount0 - lastMint.amount0;
    const delta1 = current.amount1 - lastMint.amount1;

    rebalances.push({
      owner: current.owner,
      burnRange: `[${current.tickLower}, ${current.tickUpper}]`,
      mintRange: `[${next.tickLower}, ${next.tickUpper}]`,
      burnTime: current.timestamp.toISOString(),
      mintTime: next.timestamp.toISOString(),
      amount0_in: lastMint.amount0,
      amount0_out: current.amount0,
      delta0,
      amount1_in: lastMint.amount1,
      amount1_out: current.amount1,
      delta1
    });
  }
}

// === 5. Вывод результата ===
console.log(`✅ Найдено ${rebalances.length} ребалансов:\n`);
rebalances.forEach((r, i) => {
  console.log(`--- Rebalance ${i + 1} ---`);
  console.log(`Owner: ${r.owner}`);
  console.log(`Burn Range: ${r.burnRange}`);
  console.log(`Mint Range: ${r.mintRange}`);
  console.log(`Time: ${r.burnTime} → ${r.mintTime}`);
  console.log(`Δ amount0: ${r.delta0.toFixed(6)} | Δ amount1: ${r.delta1.toFixed(6)}\n`);
});
