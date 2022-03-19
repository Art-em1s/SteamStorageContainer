const SteamUser = require('steam-user');
const GlobalOffensive = require('globaloffensive');
const axios = require('axios');
const SteamTotp = require('steam-totp');

require('dotenv').config(); //update by @antal-k on github

const username = process.env.STEAM_USERNAME;
const password = process.env.STEAM_PASSWORD;
const secret = process.env.TOTP_SECRET;
const storageUnitID = process.env.STORAGE;
var itemsToStore = [];



const user = new SteamUser();
const csgo = new GlobalOffensive(user);

const loginOptions = {
    accountName: username,
    password: password,
    twoFactorCode: SteamTotp.generateAuthCode(secret),
    rememberPassword: true
};

user.logOn(loginOptions);

user.on('error', function (e) {
    // Some error occurred during logon
    console.log(e);
});

user.on('loggedOn', async () => {
    user.on('accountInfo', (username) => {
        console.log("Logged into Steam as " + username);
    });
    await sleep(3);
    user.kickPlayingSession(); //stop other playing sessions to allow gc to connect
    user.setPersona(SteamUser.EPersonaState.Online);
    user.gamesPlayed([730]);
});

csgo.on('connectedToGC', async function () {
    if (csgo.haveGCSession) {
        itemsToStore = await getItemsFromInventory();
        await insertItems();
        quit();
    }
});

csgo.on('disconnectedFromGC', (reason) => {
    if (reason == GlobalOffensive.GCConnectionStatus.GC_GOING_DOWN) {
        console.log('GC going down');
    }
});

function quit() {
    user.gamesPlayed([]);
    user.logOff();
    user.on('disconnected', () => {
        process.exit(1);
    });
};

async function getItemsFromInventory() {
    let inventory = await getInventory();
    if (!inventory) {
        console.log('Failed to fetch the user inventory.');
        return;
    }
    let assets = inventory.assets;
    let descriptions = inventory.descriptions;
    let cases = descriptions.filter(item => item.name === process.env.ITEM_NAME);
    let assetids = [];
    if (cases) {
        for (let i in cases) {
            let item = cases[i]
            var classid = item.classid
            let a = assets.filter(item => item.classid === classid).map(function (value) { return value.assetid; });
            assetids = assetids.concat(a);
        }
    }
    return assetids;
}

async function getInventory() {
    try {
        const response = await axios.get(`https://steamcommunity.com/inventory/${user.steamID.getSteamID64()}/730/2?l=english&count=1000`);
        if (response.data && response.data.assets) {
            return response.data;
        }
    } catch (e) {
        return false;
    }
}

async function insertItems() {
    try {
        console.log(`Starting adding ${itemsToStore.length} items to storage container`);
        for (let item in itemsToStore) {
            csgo.addToCasket(storageUnitID, itemsToStore[item]);
            console.log(`Stored ${itemsToStore[item]} in ${storageUnitID}`)
            await sleep(0.5);
        }
        console.log("Completed item move");
        return;
    } catch (e) {
        console.error(e);
    }
}

async function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}