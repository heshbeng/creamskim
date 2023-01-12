// CREAMSKIM Bitcoin/USD-Stablecoin Arbitrage Bot
//
// objective:
// "skim the cream" from XXBT/USD-stablecoin 
// pairs on Kraken Exchange

// z = cream
//
// y = best (lowest) ask among all BTC-Dollar pairs
//   = price at which to buy at scoop1
//
// x = best (highest) bid among all BTC-Dollar pairs
//   = price at which to sell at scoop2
//
// x - y = z

// recommended terminal command for continuous operation:
// forever --minUptime 1000 --spinSleepTime 3000 ./creamskim3.js
// requires 'forever' node module

// import dependencies, keys, and api client

const beep = require('beepbeep');

const keyEncoded = require('./kraken_keys_encoded.json');

const keyDecode = (key) => {
  
  /* // encoding algorithm
  const buffer = Buffer.from('TYPE_KEY_HERE');
  const string = buffer.toString('base64');
  return string;
  */

  // decoding algorithm
  const buf = Buffer.from(key, 'base64');
  const str = buf.toString('ascii');
  return str;
};

const keyPub = keyDecode(keyEncoded.trade.pub);
const keyPriv = keyDecode(keyEncoded.trade.priv);

const KrakenClient = require('kraken-api');
const kraken = new KrakenClient(keyPub, keyPriv);


// define primary objects

let asset = {
  XXBT: {},
  USDC: {},
  USDT: {},
  ZUSD: {}
};

let pair = {
  XBTUSDC: {},
  XBTUSDT: {},
  XXBTZUSD: {},
  USDCUSDT: {},
  USDCUSD: {},
  USDTZUSD: {}
};

let cream = {};


// main program function

const creamSkim = async () => {
  try {


    // define timer function

    const timer = ms => new Promise(res => setTimeout(res, ms));


    // get system status

    const system = await kraken.api('SystemStatus');

    const online = system.result.status === 'online' ? true : false;
    // log online message
    if (online) {
      await timer(500);
      console.log('');
      console.log('          ~~~~~~~~~');
      console.log('          CREAMSKIM');
      console.log('          _________');
      await timer(250);
      console.log('            BEGIN')
      await timer(100);
      console.log('|=========================|');
      console.log('');
      await timer(100);
      console.log('Your pale is full of milk.');
      console.log('');
      await timer(250);
      console.log("Let's see if we can skim some cream.")
      console.log('');      
    // log !online message and end program
    } else {
      await timer(500);
      console.log('');
      console.log('|=========================|');
      console.log('');
      console.log(`SYSTEM STATUS ERROR: ${system.result.status}`);
      console.log('');
      await timer(250);
      console.log('|=========================|');
      console.log('');
      await timer(250);
      return;
    };


    // check for open orders

    const getOrders = await kraken.api('OpenOrders');

    const orders = getOrders.result.open;
    // cancel orders pending
    if (Object.keys(orders).length !== 0) {
      beep();

      console.log(`${Object.keys(orders).length} order(s) still pending. Canceling orders...`);
      console.log('');

      await kraken.api('CancelAll');
      await timer(2000);
      // confirm orders canceled
      const confirmCancel = await kraken.api('OpenOrders');
      
      const stillOpen = confirmCancel.result.open;

      if (Object.keys(stillOpen).length === 0) {
        console.log(`${Object.keys(orders).length} order(s) canceled.`);
        console.log('');
        await timer(500);

        console.log("Let's carry on now.");
        console.log('');
        await timer(500);
      // end round if orders still pending
      } else if (Object.keys(stillOpen).length) {
        console.log(`${Object.keys(stillOpen).length} order(s) still open. That's enough for this round.`);
        console.log('');
        await timer(250);
        console.log('|=========================|');
        console.log('              END');
        console.log('');
        await timer(250);
        return;
      }
    };
    // continue if no orders pending
    console.log('Readying the spoon for skimming...');
    console.log('');


    // set asset names

    for (let a of Object.keys(asset)) {
      asset[a].name = a;
    };


    // get initial balances

    const initBal = await kraken.api('Balance');
    // set initial balances
    for (let a of Object.keys(asset)) {
      asset[a].initBal = initBal.result[a] ? Number(initBal.result[a]) : 0;
    };
    //console.log(asset);


    // set pair names

    for (let p of Object.keys(pair)) {
      pair[p].name = p;
    };


    // set fees

    pair.XBTUSDC.fee = 0.1;
    pair.XBTUSDT.fee = 0.1;
    pair.XXBTZUSD.fee = 0.1;
    pair.USDCUSDT.fee = 0;
    pair.USDCUSD.fee = 0;
    pair.USDTZUSD.fee = 0;

    
    // get ticker info

    const initTicker = await kraken.api('Ticker', {pair: `${Object.keys(pair)}`});

    for (let p of Object.keys(pair)) {
      pair[`${p}`].ask = Number(initTicker.result[`${p}`].a[0]);
      pair[`${p}`].bid = Number(initTicker.result[`${p}`].b[0]);
    };
    //console.log(pair);


    // set initial dollar-equivalent balances
    
    asset.XXBT.initDolEq = asset.XXBT.initBal * initTicker.result.XXBTZUSD.c[0];
    asset.USDC.initDolEq = asset.USDC.initBal;
    asset.USDT.initDolEq = asset.USDT.initBal;
    asset.ZUSD.initDolEq = asset.ZUSD.initBal;


    // set scoop0

    cream.scoop0 = undefined;


    // get best (lowest) ask for XXBT

    cream.scoop1 = [];
    cream.scoop1.push(pair.XBTUSDC);
    cream.scoop1.push(pair.XBTUSDT);
    cream.scoop1.push(pair.XXBTZUSD);
    cream.scoop1.sort((a, b) => a.ask - b.ask);
    cream.scoop1 = [cream.scoop1[0], 'buy'];


    // get best (highest) bid for XXBT

    cream.scoop2 = [];
    cream.scoop2.push(pair.XBTUSDC);
    cream.scoop2.push(pair.XBTUSDT);
    cream.scoop2.push(pair.XXBTZUSD);
    cream.scoop2.sort((a, b) => a.bid - b.bid);
    cream.scoop2 = [cream.scoop2[2], 'sell'];


    // set cream assets

    cream.asset0 = undefined;

    cream.asset1 = asset[cream.scoop1[0].name.slice(-4)];

    cream.asset2 = asset['XXBT'];

    cream.asset3 = asset[cream.scoop2[0].name.slice(-4)];


    // define asset0

    cream.asset0 = [];

    for (let a in asset) {
      cream.asset0.push(asset[a]);
    };

    cream.asset0.sort((a, b) => a.initDolEq - b.initDolEq);

    cream.asset0 = cream.asset0[3];


    // define scoop0

    if (cream.asset0 === cream.asset2) {
      cream.scoop0 = [null];
      cream.scoop1 = [null];
    } else if (cream.asset0 === cream.asset1) {
      cream.scoop0 = [null];
    } else {
      for (let p of Object.keys(pair)) {
        if (p.includes(cream.asset0.name.slice(-3)) && p.includes(cream.asset1.name.slice(-3))) {
          cream.scoop0 = [pair[p]];
        }
      };
      cream.scoop0[1] = cream.scoop0[0].name.slice(-3) === cream.asset0.name.slice(-3) ? 'buy' : 'sell';
    };
    

    // log working message to console

    if (cream.asset0.name === 'XXBT') {
      console.log('Liquidating XXBT...');
      console.log('');
    } else {
      console.log(`Checking for cream on XXBT between ${cream.asset1.name} and ${cream.asset3.name}...`);
      console.log('');
      await timer(250);
    };


    // get scoop1 starting balance

    if (cream.scoop0[1] === 'buy') {
      cream.asset1.scoop1StartBal = cream.asset0.initBal / cream.scoop0[0].ask;
    } else if (cream.scoop0[1] === 'sell') {
      cream.asset1.scoop1StartBal = cream.asset0.initBal * cream.scoop0[0].bid;
    } else {cream.asset1.scoop1StartBal = cream.asset1.initBal};


    // get scoop2 starting balance

    cream.asset2.scoop2StartBal = cream.scoop1[0] ?
    (cream.asset1.scoop1StartBal - (cream.asset1.scoop1StartBal * 0.001)) / cream.scoop1[0].ask :
    cream.asset2.initBal;


    // get scoop2 final balance

    cream.asset3.scoop2FinalBal = (cream.asset2.scoop2StartBal - (cream.asset2.scoop2StartBal * 0.001)) * cream.scoop2[0].bid ;


    // define projected balances for round

    const bal0 = cream.scoop0[0] ? cream.asset0.initBal : null;
    const bal1 = cream.scoop1[0] ? cream.asset1.scoop1StartBal : null;
    const bal2 = cream.asset2.scoop2StartBal;
    const bal3 = cream.asset3.scoop2FinalBal;


    // estimate cream

    if (cream.scoop0[0]) {
      cream.estCream = bal3 - bal0;
    } else if (cream.scoop1[0]) {
      cream.estCream = bal3 - bal1;
    } else if (!cream.scoop1[0]) {
      cream.estCream = bal3;
    };

    if (bal0) {
      cream.estCreamPct = cream.estCream / bal0 * 100;
    } else if (bal1) {
      cream.estCreamPct = cream.estCream / bal1 * 100;
    } else {
      cream.estCreamPct = cream.estCream / bal2 * 100;
    };


    // define viability, i.e. profit margin >= 0.2%

    cream.viable = cream.estCreamPct >= 0.2 ? true : false;

    console.log('Estimated cream:');
    console.log('$ ' + cream.estCream.toFixed(3));
    console.log('% ' + cream.estCreamPct.toFixed(3));
    console.log('');

    if (!cream.viable && cream.asset0.name !== 'XXBT') {
      console.log('Unfortunately, the cream is too thin to skim off. Closing round.');
      console.log('');
      await timer(250);
      console.log('|=========================|');
      console.log('              END');
      console.log('');
      await timer(500);
      return;
    };

    if (cream.viable) {
      console.log("Looks like there's enough to skim.");
      console.log('');
    };


    // set order parameters and start balance

    let params0 = {};
    let params1 = {};
    let params2 = {};
    let startBal = undefined;


    // order 0

    if (cream.scoop0[0]) {
      startBal = cream.asset0.initDolEq;
      params0.pair = cream.scoop0[0].name;
      params0.type = cream.scoop0[1];
      params0.ordertype = 'limit';
      if (cream.scoop0[1] === 'buy') {
        params0.price = cream.scoop0[0].ask;
        params0.volume = cream.asset0.initBal / cream.scoop0[0].ask;
      };
      if (cream.scoop0[1] === 'sell') {
        params0.price = cream.scoop0[0].bid;
        params0.volume = cream.asset0.initBal;
      };
      await timer(500);
      const order0 = await kraken.api('AddOrder', params0);
      const txid0 = order0.result.txid[0];
      let status0 = undefined;
      let t0 = 0;
      do {
        t0++;
        await timer(500);
        const order0Status = await kraken.api('QueryOrders', {txid: txid0});
        status0 = order0Status.result[txid0].status;
        console.log('Scoop0 pending.')
        console.log('');
        await timer(500);
      } while (status0 !== 'closed' && t0 < 4);
      if (status0 === 'closed') {
        console.log('Scoop0 complete.');
        console.log('');
      } else {
        console.log('Closing this round to start the next one.');
        await timer(250);
        console.log('');
        console.log('|=========================|');
        console.log('              END');
        console.log('');
        await timer(250);
        return;
      };
    };


    // order 1

    if (cream.scoop1[0]) {
      if (!cream.scoop0[0]) {
        startBal = cream.asset1.initDolEq;
      };
      params1.pair = cream.scoop1[0].name;
      params1.type = cream.scoop1[1];
      params1.ordertype = 'limit';
      params1.price = cream.scoop1[0].ask;
      params1.volume = cream.asset1.scoop1StartBal / cream.scoop1[0].ask;
      await timer(500);
      const order1 = await kraken.api('AddOrder', params1);
      const txid1 = order1.result.txid[0];
      let status1 = undefined;
      let t1 = 0;
      do {
        t1++;
        await timer(500);
        const order1Status = await kraken.api('QueryOrders', {txid: txid1});
        status1 = order1Status.result[txid1].status;
        console.log('Scoop1 pending.')
        console.log('');
        await timer(500);
      } while (status1 !== 'closed' && t1 < 4);
      if (status1 === 'closed') {
        console.log('Scoop1 complete.');
        console.log('');
      } else {
        console.log('Closing this round to start the next one.');
        await timer(250);
        console.log('');
        console.log('|=========================|');
        console.log('              END');
        console.log('');
        await timer(250);
        return;
      };
    };


    // order 2

    if (!cream.scoop1[0]) {
      startBal = cream.asset2.initDolEq;
    };
    params2.pair = cream.scoop2[0].name;
    params2.type = cream.scoop2[1];
    params2.ordertype = 'limit';
    params2.price = cream.scoop2[0].bid;
    params2.volume = cream.asset2.scoop2StartBal;
    await timer(500);
    const order2 = await kraken.api('AddOrder', params2);
    const txid2 = order2.result.txid[0];
    let status2 = undefined;
    let t2 = 0;
    do {
      t2++;
      await timer(500);
      const order2Status = await kraken.api('QueryOrders', {txid: txid2});
      status2 = order2Status.result[txid2].status;
      console.log('Scoop2 pending.')
      console.log('');
      await timer(500);
    } while (status2 !== 'closed' && t2 < 4);
    if (status2 === 'closed') {
      console.log('Scoop2 complete.');
      console.log('');
      await timer(750);
      console.log('');
      // success message + summary
      console.log('Cream skimmed successfully!')
      console.log('');
      const getFinalBal = await kraken.api('Balance');
      const finalBal = Number(getFinalBal.result[cream.asset3.name]);
      console.log('Initial balance: ' + startBal);
      console.log('');
      console.log('Final balance: $ ' + finalBal);
      console.log('');
      await timer(500);
      console.log('Net cream skimmed: $ ' + finalBal.toFixed(3) - Number(startBal).toFixed(3));
      console.log('');
      console.log('|=========================|');
      console.log('              END');
      console.log('');
      await timer(500);
    } else {
      console.log('Closing this round to start the next one.');
      await timer(250);
      console.log('');
      console.log('|=========================|');
      console.log('              END');
      console.log('');
      await timer(250);
      return;
    };
    
    return;
  } catch {e => console.log(e)};
};

creamSkim();
