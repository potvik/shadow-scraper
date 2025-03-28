import fs from 'fs'
import {ClSwap} from "../types";

const readJSON = () => {
  const fileContent = fs.readFileSync('export/shadow_swaps_USDC.e_USDT_1742221934.jsonl',
    { encoding: 'utf8' });
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  return lines.map(line => JSON.parse(line)) as ClSwap[];
}

const main = async () => {
  const targetPercentage = 0.9
  const trades = readJSON()

  const pricedTrades = trades.map(trade => {
    const amount0 = parseFloat(trade.amount0);
    const amount1 = parseFloat(trade.amount1);
    const amountUSD = parseFloat(trade.amountUSD);
    let price = Math.abs(amount1 / amount0) // Price of USDC.e in USDT
    return { price, volume: amountUSD };
  }).filter(item => item.volume > 0 && item.price > 0);

  pricedTrades.sort((a, b) => a.price - b.price);

  const totalVolume = pricedTrades.reduce((sum, trade) => sum + trade.volume, 0);
  const targetVolume = totalVolume * targetPercentage;

  let currentVolume = 0;
  let lowerBound = 1; // Start at $1
  let upperBound = 1;

  for (const trade of pricedTrades) {
    currentVolume += trade.volume;
    if (trade.price < lowerBound) {
      lowerBound = trade.price;
    }
    if (trade.price > upperBound) {
      upperBound = trade.price;
    }
    if (currentVolume >= targetVolume) break;
  }

  const deviationLower = Math.abs(1 - lowerBound)
  const deviationUpper = Math.abs(1 - upperBound)
  const percentageDeviation = (deviationLower + deviationUpper) / 2 * 100

  console.log(`Price range for ${
    targetPercentage * 100
  }% of trades (centered around $1) = 1+- ${percentageDeviation.toFixed(4)}%`)
}

main()