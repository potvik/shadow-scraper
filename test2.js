const { ethers } = require("ethers");

function compute(owner, index, tickLower, tickUpper) {

    return ethers.keccak256(
        ethers.solidityPacked(
            ['address', 'uint256', 'int24', 'int24'],
            [owner, index, tickLower, tickUpper]
        )
    );
}

// Пример использования:
// A9DE4D08F53056E68F12D849F9980502A4659CBBA8DA621F0B678F86A855A7D7

const owner = "0x12e66c8f215ddd5d48d150c8f46ad0c6fb0f4406";
const index = 294455;
const tickLower = -2;
const tickUpper = -1;

const result = compute(owner, index, tickLower, tickUpper);
console.log(result);