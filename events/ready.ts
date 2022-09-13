import { Client } from "discord.js";
import gamedig from 'gamedig';
import { serverData, serverInfo } from '../index'

let server = serverData;

export = {
    name: 'ready',
    once: true,
    execute(client : Client) {
        console.log(`${client.user?.tag} is ready!`);

        gamedig.query({
            type: 'tf2',
            host: '104.238.132.130',
            port: 27016
        }).then((state) => {
            console.log(state);

            serverData.servers.push({name: "yes", playercount: 2, players: []});
            console.log(serverData);

        }).catch((error) => {
            console.log(error);
        });
    },
}