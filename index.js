const tmi = require('tmi.js');
const OBSWebSocket = require('obs-websocket-js');
const fs = require('fs');
const obs = new OBSWebSocket();

let scenes = [];
let config;
let obsMods = [];

//#region  Twitch and OBS Configuration

fs.readFileSync("config.json", (err, data) => {
    if (data) {
        cfg = data;
    }
});
if (fs.existsSync('obsMods.json')) {
    fs.readFileSync("obsMods.json", (err, data) => {
        if (data) {
            obsMods = data;
        }
    });
}


const options = {
    options: {
        debug: false
    },
    connection: {
        cluster: 'aws',
        reconnect: true,
    },
    identity: {
        username: config.twitch.BotUsername,
        password: config.twitch.Oauth
    },
    channels: [config.twitch.Channel]
};

//#endregion Configuration end

const client = new tmi.Client(options);
try {
    client.connect();

    client.on('connected', (adress, port) => {
        if (config.twitch.ShowJoinMessage) {
            client.action(config.twitch.Channel, config.twitch.JoinMessage);
        }
    }).on('message', (channel, tags, message, self) => {
        try {
            if (self) return;
            const TAGS = tags;

            if (message.startsWith(config.twitch.CommandPrefix)) {
                handleCommand(channel, cmdText.replace(config.twitch.CommandPrefix, ""));
            }
        } catch (err) {
            fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);

        }
    });
} catch (err) {
    fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);
    console.error(err.message);
}



// password is optional
obs.connect({
    address: `${config.obs.adress}:${config.obs.port}`,
    password: ''
}).then(() => {
    console.log(`Success! We're connected & authenticated.`);
    getSceneList();

}).catch(err => {
    console.log(err);
});


// Command functions

function getSceneList() {
    if (obs) {
        console.log(`Scenes -> \n${data}`);
        obs.send('GetSceneList').then(data => {
            scenes = data.scenes;
        })
    }
}

function setScene(sceneName) {
    obs.send('SetCurrentScene', {
        'scene-name': sceneName
    });
}

function handleCommand(channel, cmdText) {
    const cmdParts = cmdText.match(/([^\s]+)/g);

    switch (cmdParts[0].toLowerCase()) {
        case 'scenes':
            client.action(channel, `Scenes: ${scenes.join(', ')}`);
            break;

        case "scene":
            // TODO: set scene via index number or name of scene 
            break;

        case 'obsmod':
            if (cmdParts[1].toLowerCase() === 'add' && cmdParts[2]) {
                if (obsMods.indexOf(cmdParts[2].toLowerCase()) < 0) {
                    obsMods.push(cmdParts[2].toLowerCase());
                }
            } else if (cmdParts[1].toLowerCase() === 'remove' && cmdParts[2]) {
                if (obsMods.indexOf(cmdParts[2].toLowerCase()) < 0) {
                    obsMods.splice(obsMods.indexOf(cmdParts[2].toLowerCase(), 1));
                }
            } else {
                client.action(channel, "Invalid 3rd parameter  or add/remove. Note: Don't use '@' before persons username when adding or removing a user from ObsMods!");
            }
            fs.writeFileSync("obsMods.json", obsMods);
            break;

        case "help": case "cmds": case 'commands':
            //TODO: type all of the commands    
            client.action(channel, "");

            break;

        default:
            client.action(channel, "Invalid command!");

            break;
    }

}