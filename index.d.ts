import { Player } from "gamedig";

declare namespace Server {
    type serverInfo = {
        servers: [{
            name: string,
            playercount: number,
            players: Player[]
        }]
    }

    let serverData : serverInfo;
}