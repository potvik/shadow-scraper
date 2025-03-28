const axios = require('axios');
const fs = require('fs');

// [[0x29219dd400f2Bf60E5a23d13Be72B486D4038894]
// [0x6047828dc181963ba44974801FF68e538dA5eaF9]
// [0x3333b97138D4b086720b5aE8A7844b1345a33333]
// [0x5555b2733602DEd58D47b8D3D989E631CBee5555]]

const API_KEY = "RMY9QW17WTB26BBN5H687FEGCGFWIU5MDD";  // Replace with your API key
const CONTRACT_ADDRESS = "0x6047828dc181963ba44974801FF68e538dA5eaF9";
const SENDER_ADDRESS = "0x89b45f5b830fb5bc42d037c1130933c86da27c58";
const BASE_URL = "https://api.sonicscan.org/api";
const OFFSET = 1000;  // Max transactions per request
const START_BLOCK = 16389950 - 3 * 3600 * 24 * 14;
// const START_BLOCK = 0;
const END_BLOCK = 16389950;
const BLOCK_STEP = 500000;  // API limit adjustment

let currentStart = START_BLOCK;
let allTransactions = [];

async function fetchTransactions() {
    while (currentStart <= END_BLOCK) {
        const currentEnd = Math.min(currentStart + BLOCK_STEP, END_BLOCK);
        let page = 1;

        while (true) {
            try {
                const response = await axios.get(BASE_URL, {
                    params: {
                        module: "account",
                        action: "tokentx",
                        contractaddress: CONTRACT_ADDRESS,
                        address: SENDER_ADDRESS,
                        page: page,
                        offset: OFFSET,
                        startblock: currentStart,
                        endblock: currentEnd,
                        sort: "asc",
                        apikey: API_KEY,
                    },
                });

                if (response.data.result && response.data.result.length > 0) {
                    console.log('Gwet data: ', response.data.result.length, page, currentStart)
                    allTransactions = allTransactions.concat(response.data.result);
                    page += 1;
                } else {
                    console.log('Gwet data: ', response.data.result.length, page, currentStart)
                    break;
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                break;
            }
        }

        currentStart += BLOCK_STEP;
    }

    processTransactions();
}

function processTransactions() {
    // Convert "value" from Wei to Ether
    allTransactions = allTransactions.map(tx => ({
        ...tx,
        value: parseFloat(tx.value) * 10 ** -18
    }));

    // Save transactions to CSV
    // const csvData = allTransactions
    //     .map(tx => Object.values(tx).join(','))
    //     .join('\n');

    // fs.writeFileSync('filtered_transactions_all.csv', csvData);
    // console.log("All transactions saved to filtered_transactions_all.csv");

    // Group by recipient address and sum the received tokens
    const recipients = allTransactions.reduce((acc, tx) => {
        if (acc[tx.to]) {
            acc[tx.to] += tx.value;
        } else {
            acc[tx.to] = tx.value;
        }
        return acc;
    }, {});

    // Sort recipients by total value received
    const sortedRecipients = Object.entries(recipients)
        .sort(([, valueA], [, valueB]) => valueB - valueA)
        .slice(0, 10);

    console.log("Top 10 recipients:");
    sortedRecipients.forEach(([address, value], index) => {
        console.log(`${index + 1}. ${address}: ${value} Ether`);
    });
}

fetchTransactions();
