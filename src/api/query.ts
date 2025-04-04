import {GetEventsFilter, GetEventsParams} from "./index";

const buildWhereQuery = (filter: GetEventsFilter) => {
  let where: any = {}
  let transactionWhere = {}

  if(filter.poolSymbol) {
    where = {
      ...where,
      pool_: {
        symbol: filter.poolSymbol
      }
    }
  }

  if(filter.gauge) {
    where = {
      ...where,
      gauge: filter.gauge
    }
  }

  if(filter.blockNumber_gt) {
    transactionWhere = {
      ...transactionWhere,
      blockNumber_gt: filter.blockNumber_gt
    }
  }

  if(filter.startOfHour_gt) {
    // transactionWhere = {
    //   ...transactionWhere,
    //   startOfHour_gt: filter.startOfHour_gt
    // }
    where = {
      ...where,
      startOfHour_gt: filter.startOfHour_gt
    }
  }

  if(filter.blockNumber_lte) {
    transactionWhere = {
      ...transactionWhere,
      blockNumber_lte: filter.blockNumber_lte
    }
  }

  if(filter.timestamp_gt) {
    transactionWhere = {
      ...transactionWhere,
      timestamp_gt: filter.timestamp_gt
    }
  }

  if(filter.owner) {
    where = {
      ...where,
      owner: filter.owner
    }
  }

  if(typeof filter.liquidity_gt !== undefined) {
    where = {
      ...where,
      liquidity_gt: filter.liquidity_gt
    }
  }

  if(Object.keys(transactionWhere).length) {
    where = {
      ...where,
      transaction_: transactionWhere
    }
  }

  return buildFilterQuery(where)
}

const buildFilterQuery = (filter: Object) => {
  return JSON.stringify(filter).replace(/"([^(")"]+)":/g,"$1:");
}

export const getMintsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clMints(
      first: ${first}
      skip: ${skip}
      orderDirection: ${orderDirection},
      orderBy: ${orderBy},
      where: ${whereQuery}
    ) {
      id
      transaction {
        id
        blockNumber
        timestamp
      }
      owner
      origin
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      logIndex
      token0 {
        id
        name
        symbol
      }
      token1 {
        id
        name
        symbol
      }
      pool {
        id
        symbol
      }
    }
  }`
}

export const getBurnsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clBurns(
      first: ${first}
      skip: ${skip}
      orderDirection: ${orderDirection},
      orderBy: ${orderBy},
      where: ${whereQuery}
    ) {
      id
      transaction {
        id
        blockNumber
        timestamp
      }
      owner
      origin
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      logIndex
      token0 {
        id
        name
        symbol
      }
      token1 {
        id
        name
        symbol
      }
      pool {
        id
        symbol
      }
    }
  }`
}

export const getSwapsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clSwaps (
      first: ${first}
      orderDirection: ${orderDirection},
      orderBy: ${orderBy},
      where: ${whereQuery}
    ) {
      id
      transaction {
        id
        blockNumber
        timestamp
      }
      sender
      recipient
      origin
      amount0
      amount1
      amountUSD
      sqrtPriceX96
      tick
      logIndex
      token0 {
        id
        name
        symbol
      }
      token1 {
        id
        name
        symbol
      }
      pool {
        id
        symbol
      }
    }
  }`
}

export const getPositionsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clPositions (
      first: ${first}
      orderDirection: ${orderDirection},
      orderBy: ${orderBy},
      where: ${whereQuery}
    ) {
      collectedFeesToken0
      collectedFeesToken1
      collectedToken0
      collectedToken1
      depositedToken0
      depositedToken1
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
      id
      liquidity
      owner
      withdrawnToken0
      withdrawnToken1
      transaction {
        from
        timestamp
        id
      }
      tickUpper {
        tickIdx
        price1
        price0
      }
      tickLower {
        price1
        price0
        tickIdx
      }
    }
  }`
}

export const getRewardsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    gaugeRewardClaims(
      first: ${first}
      orderDirection: ${orderDirection},
      orderBy: ${orderBy},
      where: ${whereQuery}
    ) {
      timestamp
      id
      logIndex
      nfpPositionHash
      period
      receiver
      rewardAmount
      rewardToken {
        id
        symbol
      }
      transaction {
        id
        blockNumber
        timestamp
      }
      gauge {
        id
      }
    }
  }`
}

export const getPositionsBurnsQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clPositionBurns(
          first: ${first}
          orderDirection: ${orderDirection},
          orderBy: ${orderBy},
          where: ${whereQuery}
    ) {
      id
      transaction {
        id
        from
        timestamp
      }
      amount0
      amount1
      liquidity
      logIndex
      position {
        id
      }
      timestamp
    }
  }`
}

export const getPoolHourDatasQuery = (params: GetEventsParams) => {
  const { first = 1000, skip = 0, filter = {}, sort = {} } = params

  const whereQuery = buildWhereQuery(filter)
  const orderDirection = sort.orderDirection || 'asc'
  const orderBy = sort.orderBy || 'transaction__blockNumber'

  return `{
    clPoolHourDatas(
      first: ${first}
      orderDirection: ${orderDirection},
      orderBy: startOfHour,
      where: ${whereQuery}
    ) {
      sqrtPrice
      tick
      token0Price
      token1Price
      txCount
      volumeToken0
      volumeToken1
      startOfHour
      tvlUSD
      close
      feeGrowthGlobal0X128
      feeGrowthGlobal1X128
      feesUSD
      high
      id
      liquidity
      low
      open
    }
  }`
}


