import clipboardy from 'clipboardy';
import {getSwapXInfo} from "./swapx";
import {arrayToTSV} from "../utils";
import {getShadowInfo} from "./shadow";
import {getTokensInfo} from "./tokens";
import fs from "fs";
import { setUSDValues } from './helpers'

// const userAddress = '0x4E430992Db6F3BdDbC6A50d1513845f087E9af4A'

export interface PortfolioItem {
  asset: string
  address: string
  balance: string
  price: string // USD price
  value: string // value in USD
  type: string
  link: string
}

const portfolioItemsOrder: Array<keyof PortfolioItem> = [
  'asset', 'address',  'price', 'balance', 'value', 'type', 'link'
]

const main = async () => {
  try {
    const userAddress = process.env.npm_config_useraddress || ''
    const copyToClipboard = Boolean(process.env.npm_config_copy) || false
    const exportToTsv = Boolean(process.env.npm_config_export) || false
    if(!userAddress) {
      console.log(`No userAddress set. Usage example: npm run portfolio --userAddress=0x4E430992Db6F3BdDbC6A50d1513845f087E9af4A.`)
      process.exit(1)
    }

    const tokensInfo = await getTokensInfo(userAddress)
    const shadowInfo = await getShadowInfo(userAddress)
    const swapXInfo = await getSwapXInfo(userAddress)
    let items = await setUSDValues(
      [...tokensInfo, ...swapXInfo, ...shadowInfo]
    )

    const tsv = arrayToTSV(items, portfolioItemsOrder)
    console.log(tsv)
    if(copyToClipboard) {
      clipboardy.writeSync(tsv);
    }
    if(exportToTsv) {
      const filename = `export/portfolio_${userAddress}_${Math.round(Date.now() / 1000)}.tsv`
      fs.writeFileSync(filename, tsv, 'utf8');
      console.log(`${filename} created successfully`)
    }
  } catch (e) {
    console.error('failed to get portfolio data', e)
  }
}

main()
