const axios = require('axios');
const moment = require('moment');  // Import moment.js

const API_KEY = "RMY9QW17WTB26BBN5H687FEGCGFWIU5MDD";  // Replace with your API key
const USDCE_ADDRESS = "0x29219dd400f2Bf60E5a23d13Be72B486D4038894";  // USDC.e token
const WS_ADDRESS = "0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38";  // wS token
const POOL_ADDRESS = "0x324963c267C354c7660Ce8CA3F5f167E05649970";  // Pool address
const SHADOW_ADDRESS = "0x3333b97138D4b086720b5aE8A7844b1345a33333";  // SHADOW token
const XSHADOW_ADDRESS = "0x5050bc082FF4A74Fb6B0B04385dEfdDB114b2424";  // xSHADOW token
const SENDER_ADDRESS = "0x0ac98Ce57D24f77F48161D12157cb815Af469fc0";  // Gauge address
const BASE_URL = "https://api.sonicscan.org/api";
const OFFSET = 100;
const START_BLOCK = 10000000;
const END_BLOCK = 15000000;
const BLOCK_STEP = 100000;

async function fetchTransactions(tokenAddress, walletAddress) {
    let allTransactions = [];
    let currentStart = START_BLOCK;

    while (currentStart <= END_BLOCK) {
        let currentEnd = Math.min(currentStart + BLOCK_STEP, END_BLOCK);
        let page = 1;

        while (true) {
            const params = {
                module: "account",
                action: "tokentx",
                contractaddress: tokenAddress,
                address: walletAddress,
                page: page,
                offset: OFFSET,
                startblock: currentStart,
                endblock: currentEnd,
                sort: "asc",
                apikey: API_KEY
            };

            // console.log(params);

            try {
                const response = await axios.get(BASE_URL, { params });

                if (response.data.status === "0" && response.data.message.includes("Max calls per sec rate limit reached")) {
                    console.log("Rate limit reached. Sleeping for 10 seconds...");
                    await new Promise(resolve => setTimeout(resolve, 10000));
                    continue;
                }

                if (response.data.result) {
                    const validTransactions = response.data.result.filter(tx => typeof tx === 'object');
                    if (validTransactions.length > 0) {
                        console.log(`Fetched ${validTransactions.length} transactions...`);
                        allTransactions = allTransactions.concat(validTransactions);
                    } else {
                        console.log("No valid transactions found on this page.");
                        break;
                    }
                    page++;
                } else {
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before next request
            } catch (e) {
                console.log(`Error fetching data: ${e.message}`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }
        }

        currentStart += BLOCK_STEP;
    }

    return allTransactions;
}

async function fetchTokenPrices() {
    try {
        const response = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
            params: {
                ids: "wrapped-sonic,sonic-bridged-usdc-e-sonic,shadow-2",
                vs_currencies: "usd"
            },
            headers: {
                accept: "application/json",
                "x-cg-demo-api-key": "CG-kZxN6wxBbKn6DhoU3fWkiWui"  // Your CoinGecko API Key
            }
        });

        console.log("Data received from CoinGecko API:", response.data);

        return {
            wS_price: response.data["wrapped-sonic"]?.usd || 0,
            USDC_e_price: response.data["sonic-bridged-usdc-e-sonic"]?.usd || 1,
            SHADOW_price: response.data["shadow-2"]?.usd || 0,
            xSHADOW_price: response.data["shadow-2"]?.usd || 0
        };
    } catch (e) {
        console.log(`Error fetching token prices: ${e.message}`);
        return null;
    }
}

async function calculateRebalanceFrequencyAndApr(userAddress, wsTransfers, usdceTransfers, shadowRewards, xshadowRewards) {
    const filePath = `liquidity_${userAddress}.csv`;

    try {
        const df = require('csvtojson').fromFile(filePath);
        const dateTime = df.map(row => moment.unix(row.timeStamp)); // Using moment.js for conversion
        dateTime.sort();

        const dfGrouped = dateTime.reduce((acc, date) => {
            const blockHash = date.blockHash;
            if (!acc[blockHash]) {
                acc[blockHash] = date;
            }
            return acc;
        }, {});

        const rebalanceIntervals = Object.values(dfGrouped).map((date, index, arr) => {
            if (index === 0) return 0;
            return Math.abs(date - arr[index - 1]);
        });

        const totalRebalances = rebalanceIntervals.length;
        const avgInterval = rebalanceIntervals.reduce((acc, val) => acc + val, 0) / totalRebalances;
        const medianInterval = rebalanceIntervals[Math.floor(totalRebalances / 2)];
        const minInterval = Math.min(...rebalanceIntervals);
        const maxInterval = Math.max(...rebalanceIntervals);

        const totalDuration = (dfGrouped[totalRebalances - 1] - dfGrouped[0]);
        const days = totalDuration / (86400);  // Convert seconds to days
        const frequencyPerDay = totalRebalances / days;

        const prices = await fetchTokenPrices();
        if (!prices) {
            console.log("Could not fetch token prices. Exiting.");
            return;
        }

        const totalAddedLiquidityUSD = (wsTransfers * prices.wS_price) + (usdceTransfers * prices.USDC_e_price);
        const totalRewardsUSD = (shadowRewards * prices.SHADOW_price) + (xshadowRewards * prices.xSHADOW_price);

        const firstTransactionTime = moment(dfGrouped[0]);  // Use moment for date parsing
        const currentTime = moment();
        const liquidityDurationDays = currentTime.diff(firstTransactionTime, 'days');

        const apr = (totalRewardsUSD / totalAddedLiquidityUSD) * (365 / liquidityDurationDays) * 100;

        const results = [
            `=== Rebalance Frequency Statistics ===`,
            `Total Rebalance Events: ${totalRebalances}`,
            `Average Interval: ${avgInterval.toFixed(2)} seconds (~${(avgInterval / 3600).toFixed(2)} hours)`,
            `Median Interval: ${medianInterval.toFixed(2)} seconds (~${(medianInterval / 3600).toFixed(2)} hours)`,
            `Minimum Interval: ${minInterval.toFixed(2)} seconds`,
            `Maximum Interval: ${maxInterval.toFixed(2)} seconds (~${(maxInterval / 3600).toFixed(2)} hours)`,
            `Rebalance Frequency per Day: ${frequencyPerDay.toFixed(2)} rebalances/day`,
            `=== Liquidity & APR Calculation ===`,
            `Total Added Liquidity (USD): $${totalAddedLiquidityUSD.toFixed(2)}`,
            `Total Rewards Earned (USD): $${totalRewardsUSD.toFixed(2)}`,
            `Liquidity Duration: ${liquidityDurationDays.toFixed(2)} days`,
            `APR: ${apr.toFixed(2)}%`
        ];

        console.log(results.join("\n"));

    } catch (err) {
        console.error(`An error occurred: ${err.message}`);
    }
}

(async () => {
    const userAddress = '0x87f16c31e32ae543278f5194cf94862f1cb1eee0'; // prompt("Enter the recipient address to filter transactions: ").trim().toLowerCase();
    const wsTransactions = await fetchTransactions(WS_ADDRESS, userAddress);
    const usdceTransactions = await fetchTransactions(USDCE_ADDRESS, userAddress);

    const liquidityTransactions = wsTransactions.concat(usdceTransactions);

    // Filtering and processing transactions omitted for brevity

    const wsTransfers = 0; // Placeholder
    const usdceTransfers = 0; // Placeholder

    console.log(`Total wS added liquidity: ${wsTransfers.toFixed(6)}`);
    console.log(`Total USDC.e added liquidity: ${usdceTransfers.toFixed(6)}`);

    const shadowTransactions = await fetchTransactions(SHADOW_ADDRESS, userAddress);
    const xshadowTransactions = await fetchTransactions(XSHADOW_ADDRESS, userAddress);

    const rewardsTransactions = shadowTransactions.concat(xshadowTransactions);

    // Filtering and processing transactions omitted for brevity

    const shadowRewards = 0; // Placeholder
    const xshadowRewards = 0; // Placeholder

    console.log(`Total $SHADOW tokens received: ${shadowRewards.toFixed(6)}`);
    console.log(`Total $xSHADOW tokens received: ${xshadowRewards.toFixed(6)}`);

    await calculateRebalanceFrequencyAndApr(userAddress, wsTransfers, usdceTransfers, shadowRewards, xshadowRewards);
})();
