const SteamUser = require('steam-user');
const GlobalOffensive = require('globaloffensive');
const axios = require('axios');
const SteamTotp = require('steam-totp');

const username = "USERNAME";
const password = "PASSWORD";
const secret = "SECRET";
const storageUnitID = 17883951268; //this is the asset id for the storage unit you want to add stuff to
var itemsToStore = [];



user = new SteamUser();
csgo = new GlobalOffensive(user);

loginOptions = {
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

async function getItemsFromInventory(){
    let inventory = await getInventory();
    let assets = inventory.assets;
    let descriptions = inventory.descriptions;
    let cases = descriptions.filter(item => item.type === "Base Grade Container"); //change the string here if you want to add other types
    let assetids = [];
    if (cases) {
        for (let i in cases) {
            let item = cases[i]
            var classid = item.classid
            let a = assets.filter(item => item.classid === classid).map(function (value) { return value.assetid; });
            assetids = assetids.concat(a);
        }
        return assetids;
    }
    return [];
}

async function getInventory(){
    const response = await axios.get(`https://steamcommunity.com/inventory/${user.steamID.getSteamID64()}/730/2?l=english&count=5000`);
    if (response.data && response.data.assets) {
        return response.data;
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
    return new Promise(resolve => setTimeout(resolve, s*1000));
}