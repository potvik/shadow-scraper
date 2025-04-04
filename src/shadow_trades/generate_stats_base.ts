const fs = require('fs');
const readline = require('readline');
const { ethers } = require("ethers");
import { exportArrayToCSV, exportToJson } from "../utils";

function compute(owner: string, index: string, tickLower: string, tickUpper: string) {
    return ethers.keccak256(
        ethers.solidityPacked(
            ['address', 'uint256', 'int24', 'int24'],
            [owner, index, tickLower, tickUpper]
        )
    );
}

const contractAddress = "0x89b45f5b830fb5bc42d037c1130933c86da27c58";
const abi = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "earned",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "reward",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const rewardTokens = [
    { address: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', decimals: 6, price: 1 },
    { address: '0x6047828dc181963ba44974801FF68e538dA5eaF9', decimals: 6, price: 1 },
    { address: '0x3333b97138D4b086720b5aE8A7844b1345a33333', decimals: 18, price: 79.11 },
    { address: '0x5555b2733602DEd58D47b8D3D989E631CBee5555', decimals: 18, price: 105.029979 }
]

const getPrice = (tokenAddress: string) => {
    return rewardTokens.find(t => t.address === tokenAddress)?.price || 0;
}

// const provider = new ethers.JsonRpcProvider("wss://sonic.callstaticrpc.com");
const provider = new ethers.JsonRpcProvider("https://rpc.soniclabs.com");

const contract = new ethers.Contract(contractAddress, abi, provider);

async function getEarnedAmount(tokenAddress: string, tokenId: string, decimals: number) {
    try {
        // console.log('tokenAddress: ', tokenAddress, 'tokenId: ', tokenId, 'decimals: ', decimals)
        const earnedAmount = await contract.earned(tokenAddress, tokenId);

        if (Number(earnedAmount) > 0) {
            const price = getPrice(tokenAddress);
            // console.log('price: ', price);
            const amount = (Number(earnedAmount) / (10 ** decimals)) * price;

            //console.log(amount);

            return amount;
        }

        return 0;
    } catch (error) {
        // console.error("Ошибка при вызове метода earned:", error);
        return 0;
    }
}

const prices: any = {
    'GEMS': 105.029979,
    'xSHADOW': 79.870104,
    'USDT': 1
}

const rewards_filePath = 'export/rewards_USDC.e_USDT_1743112073.jsonl'; // путь к вашему JSONL файлу
const positions_filePath = 'export/positions_USDC.e_USDT_1743112231.jsonl'; // путь к вашему JSONL файлу
const positions_burns_filePath = 'export/positions_burns_USDC.e_USDT_1743624858.jsonl'; // путь к вашему JSONL файлу
const pool_hours_data_filePath = 'export/pool_hours_data_USDC.e_USDT_1743628848.jsonl';

const getFile = (filePath: string) => {
    return new Promise((resolve, reject) => {
        const rl = readline.createInterface({
            input: fs.createReadStream(filePath),
            output: process.stdout,
            terminal: false
        });

        const allData: any[] = [];

        rl.on('line', (line: string) => {
            try {
                const jsonData = JSON.parse(line);
                allData.push(jsonData);
            } catch (err) {
                console.error('Ошибка при парсинге строки:', err);
                reject(err);
            }
        });

        rl.on('close', () => {
            resolve(allData);
        });
    });
}

const start = async () => {
    const rewards: any = await getFile(rewards_filePath);
    const positions: any = await getFile(positions_filePath);
    const positionsBurns: any = await getFile(positions_burns_filePath);
    const poolHoursData: any = await getFile(pool_hours_data_filePath);

    console.log(rewards.length);
    console.log(positions.length);
    console.log(positionsBurns.length);
    console.log(poolHoursData.length);

    // const result = [];

    // positions.forEach(pos => {
    //     // result.push(compute(pos.owner, pos.id, pos.tickLower.tickIdx, pos.tickUpper.tickIdx));
    //     // result.push(compute(pos.transaction.from, pos.id, pos.tickLower.tickIdx, pos.tickUpper.tickIdx));
    //     result.push(compute("0x12e66c8f215ddd5d48d150c8f46ad0c6fb0f4406", pos.id, pos.tickLower.tickIdx, pos.tickUpper.tickIdx));
    // })

    // console.log('result: ', result.length)

    //console.log('rewards: ', rewards.filter(r => result.includes(r.nfpPositionHash)).length)

    const rewardsByPosition = rewards.reduce((acc: any, curr: any) => {
        acc[curr.nfpPositionHash] = [].concat(acc[curr.nfpPositionHash] || [], curr);
        return acc;
    }, {});

    console.log('rewardsByPosition: ', Object.keys(rewardsByPosition).length)

    const positionsWithRewards = positions.map((pos: any) => {
        return {
            ...pos,
            rewards: rewardsByPosition[compute(
                "0x12e66c8f215ddd5d48d150c8f46ad0c6fb0f4406",
                pos.id,
                pos.tickLower.tickIdx,
                pos.tickUpper.tickIdx
            )]?.reduce((acc: any, curr: any) => {
                acc[curr.rewardToken.symbol] = (acc[curr.rewardToken.symbol] || 0) + Number(curr.rewardAmount);

                if (!prices[curr.rewardToken.symbol]) {
                    console.log('no price for', curr.rewardToken.symbol)
                }

                acc['USD'] = (acc['USD'] || 0) + Number(curr.rewardAmount) * prices[curr.rewardToken.symbol];

                return acc;
            }, {})
        }
    }).map((p: any) => {
        return {
            ...p,
            totalUSD: p.rewards?.['USD'] || 0 + Number(p.collectedFeesToken0) + Number(p.collectedFeesToken1)
        }
    })

    positionsWithRewards.sort((a: any, b: any) => {
        return b.totalUSD - a.totalUSD;
    })

    let totalUSD = positionsWithRewards.reduce((acc: number, curr: any) => {
        return acc + (Number(curr.totalUSD) || 0);
    }, 0)

    console.log('totalUSD: ', totalUSD)

    // console.log(positionsWithRewards.filter(p => p.rewards?.['USD'] > 300).length)

    console.log(positionsWithRewards.length)

    for (let i = 0; i < positionsWithRewards.length; i += 200) {
        break;

        const requests: any[] = [];

        positionsWithRewards.slice(i, i + 200).forEach((p: any) => {
            rewardTokens.forEach((token: any) => {
                requests.push({
                    token: token.address,
                    id: p.id,
                    decimals: token.decimals
                })
            })
        })

        const amounts = await Promise.all(requests.map(async (req) => {
            return await getEarnedAmount(req.token, req.id, req.decimals);
        }));

        amounts.forEach((amount, idx) => {
            if (positionsWithRewards[i + idx]) {
                positionsWithRewards[i + idx].totalUSD += Number(amount) || 0;
            }
        })

        console.log(Math.round((i + 200) / positionsWithRewards.length * 100) + '/100 %')
    }

    totalUSD = positionsWithRewards.reduce((acc: number, curr: any) => {
        return acc + (Number(curr.totalUSD) || 0);
    }, 0)

    const TVL = positionsWithRewards.reduce((acc: number, curr: any) => {
        return acc + (Number(curr.depositedToken0) || 0) + (Number(curr.depositedToken1) || 0);
    }, 0)

    console.log('TVL: ', TVL);

    const positionsFinal = positionsWithRewards.map((p: any) => {
        const daysElapsed = (Date.now() - p.transaction.timestamp * 1000) / (1000 * 60 * 60 * 24);

        // console.log('daysElapsed: ', daysElapsed);

        return {
            ...p,
            apr: (((p.totalUSD / (Number(p.depositedToken0) + Number(p.depositedToken1))) * (365 / daysElapsed)) * 100).toFixed(2),
            apr_30d: (((p.totalUSD / (Number(p.depositedToken0) + Number(p.depositedToken1))) * (30 / daysElapsed)) * 100).toFixed(2),
            price_mid: ((Number(p.tickLower.price0) + Number(p.tickUpper.price0)) / 2).toFixed(4),
            ticks: Math.abs(p.tickUpper.tickIdx - p.tickLower.tickIdx)
        }
    })

    console.log('totalUSD: ', totalUSD)

    positionsFinal.sort((a: any, b: any) => {
        return b.apr_30d - a.apr_30d;
    })

    // new

    console.log('Total positions: ',  positionsFinal.length);

    const uniqueOwners = positionsFinal.reduce((acc: any, pos: any) => {
        return {
            ...acc,
            [pos.transaction.from]: (acc[pos.transaction.from] || 0) + 1 
        }
    }, {});

    console.log('Unique owners: ',  Object.keys(uniqueOwners).length, Math.max.apply(this, Object.values(uniqueOwners)));

    // console.log(positionsFinal.filter(p => p.id == '295623'))
    // 295623.0	-3.0	2.0	5.0	8760.9	4999.4	0.0	0.0	13760.3	-13760.3	-1216.67	0.9997	1.0002	0.00049995	1.0
    const swapsCsv = positionsFinal.map((pos: any) => {
      return {
        id: pos.id,
        tick_lower: pos.tickLower.tickIdx,
        tick_upper: pos.tickUpper.tickIdx,
        ticks: pos.ticks,
        deposited_token0: pos.depositedToken0,
        deposited_token1: pos.depositedToken1,
        collected_token0: pos.collectedToken0,
        collected_token1: pos.collectedToken1,
        total_deposited_usd: Number(pos.depositedToken0) + Number(pos.depositedToken1),
        total_profit_usd: pos.totalUSD,
        apr_30d: pos.apr_30d,
        apr: pos.apr,
        price_lower: Number(pos.tickLower.price0).toFixed(4),
        price_upper: Number(pos.tickUpper.price0).toFixed(4),
        price_range: (Number(pos.tickUpper.price0) - Number(pos.tickLower.price0)).toFixed(4),
        price_mid: Number(pos.price_mid).toFixed(4),
      }
    })
    const poolSymbol = 'USDC.e/USDT'

    return;

    const exportFileName = `export/positions_stats_${poolSymbol.replace('/', '_')
        }_${Math.round(Date.now() / 1000)
        }`
    console.log(`Total swaps: ${swapsCsv.length}. Exporting to ${exportFileName}...`)
    exportArrayToCSV(`${exportFileName}.csv`, swapsCsv)
    // await exportToJson(`${exportFileName}.jsonl`, swaps)
    console.log('Export complete! check' + exportFileName)
};

start();
