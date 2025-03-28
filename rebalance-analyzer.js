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
    amount0: parseFloat(e.amount0),
    amount1: parseFloat(e.amount1),
  }));
}

function tickToPrice(tick) {
  return Math.pow(1.0001, tick);
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

function calculatePriceRange(tickLower, tickUpper) {
  const priceLower = tickToPrice(tickLower);
  const priceUpper = tickToPrice(tickUpper);
  return { priceLower, priceUpper };
}

function calculateRangeWidth(priceLower, priceUpper) {
  return ((priceUpper - priceLower) / priceLower) * 100;
}

function calculateStatistics(rebalances) {
  if (rebalances.length === 0) return null;

  const stats = {
    totalRebalances: rebalances.length,
    uniqueAddresses: new Set(rebalances.map(r => r.owner)).size,
    averageTimeBetweenBurnAndMint: 0,
    maxTimeBetweenBurnAndMint: 0,
    minTimeBetweenBurnAndMint: Infinity,
    
    averageOldRangeWidth: 0,
    averageNewRangeWidth: 0,
    
    totalOldAmount0: 0,
    totalOldAmount1: 0,
    totalNewAmount0: 0,
    totalNewAmount1: 0,
    
    timeDistribution: {
      under1min: 0,
      under5min: 0,
      under30min: 0,
      under1hour: 0,
      over1hour: 0
    },

    firstRebalanceDate: formatDate(rebalances[0].timestamp),
    lastRebalanceDate: formatDate(rebalances[rebalances.length - 1].timestamp),
  };

  rebalances.forEach(rebalance => {
    // Время между операциями
    stats.averageTimeBetweenBurnAndMint += rebalance.timeDiff;
    stats.maxTimeBetweenBurnAndMint = Math.max(stats.maxTimeBetweenBurnAndMint, rebalance.timeDiff);
    stats.minTimeBetweenBurnAndMint = Math.min(stats.minTimeBetweenBurnAndMint, rebalance.timeDiff);

    // Распределение по времени
    if (rebalance.timeDiff < 60) stats.timeDistribution.under1min++;
    else if (rebalance.timeDiff < 300) stats.timeDistribution.under5min++;
    else if (rebalance.timeDiff < 1800) stats.timeDistribution.under30min++;
    else if (rebalance.timeDiff < 3600) stats.timeDistribution.under1hour++;
    else stats.timeDistribution.over1hour++;

    // Ширина диапазонов
    const oldRangeWidth = calculateRangeWidth(rebalance.oldPosition.priceLower, rebalance.oldPosition.priceUpper);
    const newRangeWidth = calculateRangeWidth(rebalance.newPosition.priceLower, rebalance.newPosition.priceUpper);
    stats.averageOldRangeWidth += oldRangeWidth;
    stats.averageNewRangeWidth += newRangeWidth;

    // Суммарная ликвидность
    stats.totalOldAmount0 += Math.abs(rebalance.oldPosition.amount0);
    stats.totalOldAmount1 += Math.abs(rebalance.oldPosition.amount1);
    stats.totalNewAmount0 += Math.abs(rebalance.newPosition.amount0);
    stats.totalNewAmount1 += Math.abs(rebalance.newPosition.amount1);
  });

  // Вычисляем средние значения
  stats.averageTimeBetweenBurnAndMint /= rebalances.length;
  stats.averageOldRangeWidth /= rebalances.length;
  stats.averageNewRangeWidth /= rebalances.length;

  return stats;
}

function matchRebalances(mints, burns, timeWindow = 3600) {
  let rebalances = [];
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
      const burn = userBurns[matchIndex];
      
      // Рассчитаем изменения
      const timeDiff = Math.abs(mint.timestamp - burn.timestamp);
      const oldRange = calculatePriceRange(burn.tickLower, burn.tickUpper);
      const newRange = calculatePriceRange(mint.tickLower, mint.tickUpper);
      
      rebalances.push({
        owner: mint.owner,
        timestamp: mint.timestamp,
        timeDiff,
        oldPosition: {
          tickLower: burn.tickLower,
          tickUpper: burn.tickUpper,
          priceLower: oldRange.priceLower,
          priceUpper: oldRange.priceUpper,
          amount0: burn.amount0,
          amount1: burn.amount1,
        },
        newPosition: {
          tickLower: mint.tickLower,
          tickUpper: mint.tickUpper,
          priceLower: newRange.priceLower,
          priceUpper: newRange.priceUpper,
          amount0: mint.amount0,
          amount1: mint.amount1,
        }
      });

      // Удаляем использованный burn
      userBurns.splice(matchIndex, 1);
    }
  }

  return rebalances;
}

const mints = parseEvents(pool.mints);
const burns = parseEvents(pool.burns);

const rebalances = matchRebalances(mints, burns);
const stats = calculateStatistics(rebalances);

console.log(`📊 Статистика пула:`);
console.log(`→ Тик спейсинг: ${pool.tickSpacing}`);
console.log(`→ Текущий тик: ${pool.tick} (цена: $${tickToPrice(pool.tick).toFixed(4)})`);
console.log(`→ Всего mint операций: ${mints.length}`);
console.log(`→ Всего burn операций: ${burns.length}`);
console.log('---');

console.log('\n📈 Статистика ребалансов:');
console.log(`→ Общее количество ребалансов: ${stats.totalRebalances}`);
console.log(`→ Уникальных адресов: ${stats.uniqueAddresses}`);
console.log(`→ Первый ребаланс: ${stats.firstRebalanceDate}`);
console.log(`→ Последний ребаланс: ${stats.lastRebalanceDate}`);
console.log('---');

console.log('\n⏱️ Временные характеристики:');
console.log(`→ Среднее время между burn и mint: ${stats.averageTimeBetweenBurnAndMint.toFixed(1)} сек`);
console.log(`→ Минимальное время: ${stats.minTimeBetweenBurnAndMint} сек`);
console.log(`→ Максимальное время: ${stats.maxTimeBetweenBurnAndMint} сек`);
console.log('\nРаспределение по времени:');
console.log(`→ До 1 минуты: ${stats.timeDistribution.under1min} (${(stats.timeDistribution.under1min/stats.totalRebalances*100).toFixed(1)}%)`);
console.log(`→ 1-5 минут: ${stats.timeDistribution.under5min} (${(stats.timeDistribution.under5min/stats.totalRebalances*100).toFixed(1)}%)`);
console.log(`→ 5-30 минут: ${stats.timeDistribution.under30min} (${(stats.timeDistribution.under30min/stats.totalRebalances*100).toFixed(1)}%)`);
console.log(`→ 30-60 минут: ${stats.timeDistribution.under1hour} (${(stats.timeDistribution.under1hour/stats.totalRebalances*100).toFixed(1)}%)`);
console.log(`→ Более часа: ${stats.timeDistribution.over1hour} (${(stats.timeDistribution.over1hour/stats.totalRebalances*100).toFixed(1)}%)`);
console.log('---');

console.log('\n📏 Характеристики диапазонов:');
console.log(`→ Средняя ширина старого диапазона: ${stats.averageOldRangeWidth.toFixed(2)}%`);
console.log(`→ Средняя ширина нового диапазона: ${stats.averageNewRangeWidth.toFixed(2)}%`);
console.log('---');

console.log('\n💧 Изменение ликвидности:');
console.log('Старые позиции:');
console.log(`→ Всего token0: ${stats.totalOldAmount0.toFixed(4)}`);
console.log(`→ Всего token1: ${stats.totalOldAmount1.toFixed(4)}`);
console.log('Новые позиции:');
console.log(`→ Всего token0: ${stats.totalNewAmount0.toFixed(4)}`);
console.log(`→ Всего token1: ${stats.totalNewAmount1.toFixed(4)}`);
console.log('---');
