const tmi = require('tmi.js');
const OBSWebSocket = require('obs-websocket-js');
const fs = require('fs');
const obs = new OBSWebSocket();

let scenes = [];
let macros = [];
let obsMods;
let privileges;

//#region  Twitch and OBS Configuration

let config = JSON.parse(fs.readFileSync("config.json"));
if (fs.existsSync('obsMods.json')) {
    obsMods = JSON.parse(fs.readFileSync("obsMods.json"));
}
if (fs.existsSync('macros.json')) {
    macros = JSON.parse(fs.readFileSync("macros.json"));
}
if (fs.existsSync('privileges.json')) {
    const tmp = JSON.parse(fs.readFileSync("privileges.json"));
    privileges = new Map(tmp.map(i => [i.user.toLowerCase(), i.cmds]));
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

function canUseOBS(username) {
    return (obsMods && (obsMods.indexOf(username) >= 0)) || (username === config.twitch.channel.toLowerCase());
}

function canUseCommand(username, cmd) {
    if (username === config.twitch.channel.toLowerCase()) return true;

    if (privileges && privileges.has(username)) {
        return privileges.get(username).includes(cmd) || privileges.get(username).includes('*');
    }
    return false;
}

function handleCommand(channel, username, cmdText, pass = false) {

    const cmdParts = cmdText.match(/([^\s]+)/g);

    if (!pass && !canUseCommand(username, cmdParts[0])) {
        client.action(channel, username + ", you don't have privileges to use that command.");
        return;
    }

    switch (cmdParts[0].toLowerCase()) {
        case 'scenes': case 'getscenes':

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

        case 'obs': case 'obsmod':
            if (username === config.twitch.channel) {
                if (cmdParts[1].toLowerCase() === 'add' && cmdParts[2]) {
                    const modUser = (cmdParts[2].toLowerCase().indexOf("@") == 0) ? cmdParts[2].toLowerCase().replace("@", "") : cmdParts[2].toLowerCase();
                    if (obsMods.indexOf(modUser) < 0) {
                        obsMods.push(modUser);
                    }
                } else if ((cmdParts[1].toLowerCase() === 'remove' || cmdParts[1].toLowerCase() === 'rm') && modUser) {
                    if (obsMods.indexOf(modUser) >= 0) {
                        obsMods.splice(obsMods.indexOf(modUser), 1);
                    }
                } else {
                    client.action(channel, "Invalid command parameter/s. Use <help/commands/cmds> command for help!");
                    return;
                }

                fs.writeFileSync("obsMods.json", JSON.stringify(obsMods));
            } else {
                client.action(channel, `Only ${config.twitch.channel} can add or remove OBS mods.`);
                return;
            }
            break;

        case "cmds": case 'commands':
            client.action(channel, `${config.twitch.commandPrefix}scenes/getscenes, ${config.twitch.commandPrefix}scene/setscene <index>, ${config.twitch.commandPrefix}sources/getsources <scene_index>, ${config.twitch.commandPrefix}source/setsource <scene_index> <source_index> <true|false>, ${config.twitch.commandPrefix}obs/obsmod <add|remove/rm> <username>, ${config.twitch.commandPrefix}help <command>, ${config.twitch.commandPrefix}cmds/commands`);
            let customCmds = "";
            macros.forEach(mac => {
                customCmds += "" + config.twitch.commandPrefix + mac.macro + ", ";
            });
            client.action(channel, "Custom commands: " + customCmds);
            break;

        case "help":
            switch (cmdParts[1].toLowerCase()) {
                case 'scenes': case 'getscenes':
                    client.action(channel, username + ", scenes/getscene ~ Lists all of the scenes with indexes.");
                    break;

                case "scene": case 'setscene':
                    client.action(channel, username + ", scene/setscene <scene_index> ~ Sets the scene via it's index number. Type scenes command to see scene indexes.");
                    break;

                case 'sources': case 'getsources':
                    client.action(channel, username + ", sources/getsource <scene_index> ~ Lists all of the sources with indexes for given scene.");
                    break;

                case 'source': case 'setsource':
                    client.action(channel, username + ", source/setsource <scene_index> <source_index> <true|false> ~ Sets the visibility of source (index) on given scene (index)");
                    break;

                case 'obs': case 'obsmod':
                    client.action(channel, username + ", obs/obsmods <add|remove/rm> ~ Adds or removes a user that can change the obs settings. Broadcaster is always allowes to edit.");
                    break;

                default:
                    client.action(channel, username + "Invlalid commad. After help sould go a command. ex. !help scenes");
                    break;
            }
            break;

        default:
            let hit = false;

            for (let i = 0; i < macros.length; i++) {
                if (macros[i].macro === cmdParts[0]) {
                    macros[i].cmds.forEach(cmd => {
                        handleCommand(channel, username, cmd, true);
                    });
                    hit = true;
                    break;
                }
            }

            if (!hit) {
                client.action(channel, `Invalid use of command! Type ${config.twitch.commandPrefix}help <command> or ${config.twitch.commandPrefix}cmds/commands to view all the commands to get some details`);
            }

            break;
    }

}

//#endregion Command functions



//#region Twitch & OBS commection
const client = new tmi.Client(options);
try {
    obs.connect({
        address: `${config.obs.adress}:${config.obs.port}`,
        password: config.obs.password
    }).catch(err => {
        fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);
        console.error(err.message);
    });

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
                if (canUseOBS(tags.username)) {
                    handleCommand(channel, tags.username, message.replace(config.twitch.commandPrefix, ""));
                }
            }
        } catch (err) {
            fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);

        }
    });
} catch (err) {
    fs.appendFileSync("errors.log", `${(new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':')}\n${err.message}\n\n`);
    console.error(err.message);
}


//#endregion Twitch & OBS commection