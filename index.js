const tmi = require('tmi.js');
const OBSWebSocket = require('obs-websocket-js');
const fs = require('fs');
const obs = new OBSWebSocket();

let scenes = [];
let obsMods = [];

//#region  Twitch and OBS Configuration

let config = JSON.parse(fs.readFileSync("config.json"));
if (fs.existsSync('obsMods.json')) {
    obsMods = JSON.parse(fs.readFileSync("obsMods.json"));
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
        username: config.twitch.botUsername,
        password: config.twitch.oAuth
    },
    channels: [config.twitch.channel]
};

//#endregion Configuration end


//#region Command functions

const getSceneList = () => {
    if (obs) {
        obs.send('GetSceneList').then(data => {
            // console.log(data);
            scenes = data;

        }).catch(err => {
            console.log(err);
        });
    }
}

function setScene(sceneName) {
    obs.send('SetCurrentScene', {
        'scene-name': sceneName
    }).catch(err => {
        console.log(err);
    });
}

function setSourceVisability(scene, source, visable) {
    obs.send('SetSourceRender', {
        'scene-name': scene,
        'source': source,
        'render': visable
    }).catch(err => {
        console.log(err);
    });
}

function handleCommand(channel, username, cmdText) {

    const cmdParts = cmdText.match(/([^\s]+)/g);

    switch (cmdParts[0].toLowerCase()) {
        case 'scenes': case 'getscenes':

            //getSceneList();
            console.log(scenes.scenes);

            let tmp = [];

            for (let i = 0; i < scenes.scenes.length; i++) {
                tmp.push(i + ". " + scenes.scenes[i].name);
            }
            client.action(channel, `Scenes: ${tmp.join(", ")}`);
            break;

        case "scene": case 'setscene':
            const num = parseInt(cmdParts[1]);

            if (num >= 0 && num < scenes.scenes.length) {
                setScene(scenes.scenes[num].name);
            } else {
                client.action(channel, `Scene index must be between 0 and ${scenes.scenes.length - 1}!`);
            }

            break;

        case 'sources': case 'getsources':
            if (!cmdParts[1] || isNaN(cmdParts[1])) {
                client.action(channel, cmdParts[1] + ` is not a number! Use index between 0 and ${scenes.scenes.length} for a scene.`);
                return;
            } else {
                const sceneInd = parseInt(cmdParts[1]);
                if (sceneInd < scenes.scenes.length && sceneInd >= 0) {
                    let tmp = [];
                    for (let i = 0; i < scenes.scenes[sceneInd].sources.length; i++) {
                        tmp.push(i + ". " + scenes.scenes[sceneInd].sources[i].name);
                    }

                    client.action(channel, `Available sources for '${scenes.scenes[sceneInd].name}': ${tmp.join(", ")}`);
                    return;
                } else {
                    client.action(channel, `Index does not exist. Use index between 0 and ${scenes.scenes.sources.length}`);
                }
            }
            break;

        case 'source': case 'setsource':
            if (!cmdParts[1] || isNaN(cmdParts[1]) || !cmdParts[2] || isNaN(cmdParts[2])) {
                client.action(channel, "Invalid command parameters. Use index to set the source visibility!");
                return;
            } else {
                setSourceVisability(scenes.scenes[parseInt(cmdParts[1])].name, scenes.scenes[parseInt(cmdParts[1])].sources[parseInt(cmdParts[2])].name, JSON.parse(cmdParts[3]));
            }
            break;

        case 'obsmod':
            if (username === config.twitch.channel) {
                if (cmdParts[1].toLowerCase() === 'add' && cmdParts[2]) {
                    if (obsMods.indexOf(cmdParts[2].toLowerCase()) < 0) {
                        obsMods.push(cmdParts[2].toLowerCase());
                    }
                } else if ((cmdParts[1].toLowerCase() === 'remove' || cmdParts[1].toLowerCase() === 'rm') && cmdParts[2]) {
                    if (obsMods.indexOf(cmdParts[2].toLowerCase()) < 0) {
                        obsMods.splice(obsMods.indexOf(cmdParts[2].toLowerCase(), 1));
                    }
                } else {
                    client.action(channel, "Invalid 3rd parameter or add/remove. Note: Don't use '@' before persons username when adding or removing a user from ObsMods!");
                    return;
                }
                fs.writeFileSync("obsMods.json", obsMods);
            } else {
                client.action(channel, `Only ${config.twitch.channel} can add or remove OBS mods.`);
                return;
            }
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

//#endregion Command functions



//#region Twitch & OBS commection
const client = new tmi.Client(options);
try {
    client.connect();

    client.on('connected', (adress, port) => {
        getSceneList();
        if (config.twitch.showJoinMessage) {
            client.action(config.twitch.channel, config.twitch.joinMessage);
        }
    }).on('message', (channel, tags, message, self) => {
        try {
            if (self) return;

            if (message.startsWith(config.twitch.commandPrefix)) {
                handleCommand(channel, tags.username, message.replace(config.twitch.commandPrefix, ""));
            }
        } catch (err) {
            fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);

        }
    });
} catch (err) {
    fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);
    console.error(err.message);
}

obs.connect({
    address: `${config.obs.adress}:${config.obs.port}`,
    password: config.obs.password
}).catch(err => {
    fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);
    console.error(err.message);
});

//#endregion Twitch & OBS commection