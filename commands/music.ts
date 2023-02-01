import { VoiceConnectionStatus, entersState, joinVoiceChannel, VoiceConnection, getVoiceConnection, createAudioPlayer, AudioPlayer, AudioPlayerStatus, createAudioResource, StreamType} from '@discordjs/voice';
import { ChatInputCommandInteraction, EmbedBuilder, Guild, GuildMember, Message, PermissionFlagsBits, SlashCommandBuilder, TextBasedChannel } from "discord.js";
import ytdl from "ytdl-core";
import ytdld from "ytdl-core-discord"
import yts from "yt-search"
import ytpl from 'ytpl';

const queueList = new Map<string, queue>;

const defaultQueue: queue =
{
    owner: "",
    ownerName: "",
    vc: "",
    queue: [],
    skipVotes: [],
}

const initialEmbed = new EmbedBuilder()
    .setTitle('Starting song shortly.');

const playingEmbed = new EmbedBuilder()
    .setColor(0x03fc13)
    .setTitle('Currently Playing')
    .setDescription('Title by Artist')

const endedEmbed = new EmbedBuilder()
    .setColor(0xbd0000)
    .setTitle('Finished playing music.')

export = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('Music bot')
        .addSubcommand(subcommand =>
            subcommand.setName('play').setDescription("Play music in your current vc.")
            .addStringOption(option => option.setName('video').setDescription('Video link for music (currently only youtube)').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('stop').setDescription("Stops the music bot and removes it from vc.")
        )
        .addSubcommand(subcommand => subcommand.setName("skip").setDescription("Skips the current song playing on the bot."))
        .addSubcommand(subcommand => subcommand.setName("queue").setDescription("Sends a list of the first 5 songs current music queue."))
        .addSubcommand(subcommand => subcommand.setName("forcedj").setDescription("Force gives yourself control of the active bot.")),
    async execute(interaction : ChatInputCommandInteraction) 
    {
        await interaction.deferReply({ephemeral: true});

        const member = interaction.member as GuildMember;
        if (member == null) return await interaction.editReply("Failed to get member.");

        const vc = member.voice.channel;
        if (vc == null) return await interaction.editReply("You need to be in a voice channel to use this!");
        const vcChannel = vc.id;

        if (interaction.guild == null) return await interaction.editReply("Failed to get discord server.");
		const guild = interaction.guild;

        const channel = interaction.channel;
        if (!channel) return await interaction.editReply("Failed to get text channel.");

        let serverQueue: queue = queueList.get(guild.id) ?? Object.assign({}, defaultQueue);

        let connection: VoiceConnection | undefined = getVoiceConnection(guild.id);
        let audioPlayer: AudioPlayer | undefined;
        let message : Message;

        switch (interaction.options.getSubcommand())
        {
            case "play":
            {
                let video = interaction.options.getString("video", true);
                let videos: string[] = [];

                const playlistID = video.match(/&list=(.*?)(?=&index|$)/);

                if (playlistID && ytpl.validateID(playlistID[1]))
                {
                    let playlist: ytpl.Result | null = null;

                    try 
                    {
                        playlist = await ytpl(playlistID[1]);
                    }
                    catch(err)
                    {
                        // do nothing as next if statement will handle it
                    }

                    //keep it here so that it will satisfy typescript
                    if (!playlist) return await interaction.editReply("Invalid playlist!"); 

                    for (const playlistItem of playlist.items)
                        videos.push(playlistItem.url);
                }
                else if (!ytdl.validateURL(video))
                {
                    const search = await yts(video);

                    if (search.videos.length > 0)
                        video = search.videos[0].url;
                    else
                        return await interaction.editReply("Couldn't find a video with that url or name!");
                }

                videos.push(video);

                async function addToQueue(video: string)
                {
                    const info = await ytdl.getBasicInfo(video);
                    const title = info.videoDetails.title;
                    const author = info.videoDetails.author;
                    const url = info.videoDetails.video_url;

                    const seconds = parseInt(info.videoDetails.lengthSeconds);
                    const time = new Date(seconds * 1000).toISOString().substring(14, 19);

                    const position = serverQueue.queue.push({
                        url: url,
                        name: title,
                        author: author.name,
                        authorUrl: author.channel_url,
                        length: time,
                        img: info.videoDetails.thumbnails[1].url,
                        requester: member.user.tag,
                        requesterIcon: member.user.avatarURL(),
                    });
                    
                    return position;
                }
                
                let position = 0;
                for (let i = 0; i < videos.length; i++)
                {
                    const tempPos = await addToQueue(videos[i]);
                    if (i == 0)
                        position = tempPos;
                }
                
                //get info on first song
                const info = await ytdl.getBasicInfo(videos[0]);
                const title = info.videoDetails.title;
                const author = info.videoDetails.author;

                // This should not be needed but somehow it is
                defaultQueue.queue = [];

                if (!connection)
                {
                    message = await interaction.channel.send({embeds: [initialEmbed]});

                    serverQueue.owner = member.id;
                    serverQueue.ownerName = member.user.tag;
                    serverQueue.vc = vcChannel;
                    serverQueue.text = interaction.channel;
                    serverQueue.msg = message;
                    createConnection();
                    playMusic();

                    await interaction.editReply(`Started playing \`${title}\` by \`${author.name}\`.`);
                }
                else
                {
                    playingEmbed.spliceFields(-1, 1);
                    playingEmbed.addFields({name: 'Queue Remaining:', value: `${serverQueue.queue.length}`, inline: true});
                    serverQueue.msg?.edit({embeds: [playingEmbed]});

                	await interaction.editReply(`Added \`${title}\` by \`${author.name}\` to the queue at position **${position}**.`);
            	}

                queueList.set(guild.id, serverQueue);

                break;
            }

            case "stop":
            {
                if (!connection) return await interaction.editReply("There is no active music bot in this server!");

                if (serverQueue.owner != member.id)
                	return await interaction.editReply("You are not the current owner of the bot!");

                await interaction.editReply("Stopped the music player.");

                await stop();

                break;
            }

            case "skip":
            {
                if (!connection) return await interaction.editReply("There is no active music bot in this server!");

                if (vcChannel != serverQueue.vc) interaction.editReply("You aren't in the same vc as the music bot!");

                if (serverQueue.owner != member.id)
                {
                    if (serverQueue.skipVotes.includes(member.id))
                    	return await interaction.editReply("You already voted!");

                    serverQueue.skipVotes.push(member.id);
					
                    const votesNeeded = Math.floor(vc.members.size * .75);
                    const votes = serverQueue.skipVotes.length;

                    await interaction.editReply("Voted to skip.");

                    if (votes < votesNeeded)
                    {
                        serverQueue.text?.send(`${member.user.username} voted to skip the song. (${votes}/${votesNeeded})`);
                        return;
                    }
                    else
                    	serverQueue.text?.send(`${member.user.username} vote to skip the song. Vote passed.`);
                }
                else
                    await interaction.editReply("Skipped current song.");

                audioPlayer?.stop();
                playMusic();

                return;
            }

            case "queue":
            {
                if (!connection) return await interaction.editReply("There is no active music bot in this server!");

                const queueLength = serverQueue.queue.length;

                if (queueLength < 1) return await interaction.editReply("There is nothing in the queue.");
                
                let queueMsg = new EmbedBuilder()
                    .setTitle("Music Queue")
                    .setDescription(`Currently ${queueLength} in queue.`)

                const listSize = Math.min(5, queueLength);

                for (let i = 0; i < listSize; i++)
                {
                    const queueItem: queueEntry = serverQueue.queue[i];

                    queueMsg.addFields({name: `#${i+1}: ${queueItem.name} by ${queueItem.author}`, value: `**Requested by:** ${queueItem.requester} **Length:** ${queueItem.length}`});
                }

                interaction.editReply({embeds: [queueMsg]});
            }

            case "forcedj":
            {
                if (!connection) return await interaction.editReply("There is no active music bot in this server!");

                if (!member.permissions.has([PermissionFlagsBits.BanMembers])) return await interaction.editReply("You don't have permission to use this command!");

                serverQueue.owner = member.id;
                serverQueue.ownerName = member.user.tag;
                
				queueList.set(guild.id, serverQueue);

                interaction.editReply("You are now the DJ of the bot.");
            }
        }

        async function createConnection()
        {
            const temp = getVoiceConnection(guild.id);

            if (temp)
            {
                connection = temp;
                return;
            }

            connection = joinVoiceChannel({
                channelId: serverQueue.vc,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newStatus) => {
                if (!connection) return;

                try
                {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                }
                catch (error)
                {
                	stop();
                    return;
                }
            })
        }

        async function playMusic()
        {
            if (!connection) return;

            const tempQueue = queueList.get(guild.id);

            if (tempQueue && serverQueue.queue.length < tempQueue.queue.length)
                serverQueue.queue = tempQueue.queue;

            if (serverQueue.queue.length < 1)
            {
                setTimeout(() => {
                    if (serverQueue.queue.length < 1)
                    {
                        stop();
                    }
                }, 10000)
                return;
            }

            serverQueue.skipVotes = [];

            const music: queueEntry = serverQueue.queue.shift() as queueEntry;


            if (!audioPlayer)
            {
                audioPlayer = createAudioPlayer();

                audioPlayer.on(AudioPlayerStatus.Idle, () => {
                    playMusic();
                });

                audioPlayer.on('error', error => {
                    console.log(error);
                })

                connection.subscribe(audioPlayer);
            }

            const stream = await ytdld(music.url, {filter: 'audioonly', highWaterMark: 1 << 25});
            const resource = createAudioResource(stream, {inlineVolume: true, inputType: StreamType.Opus});
            resource.volume?.setVolume(0.25);

            audioPlayer?.play(resource);

            const redeemIcon = music.requesterIcon != null ? music.requesterIcon : undefined;

            playingEmbed.setDescription(`[${music.name}](${music.url}) by [${music.author}](${music.authorUrl}).`)
                .setFields({name: 'Length', value: `${music.length}`, inline: true}, {name: 'Queue Remaining:', value: `${serverQueue.queue.length}`, inline: true})
                .setThumbnail(music.img)
                .setAuthor({name: `Requested by: ${music.requester}`, iconURL: redeemIcon})
                .setFooter({text: `Current DJ: ${serverQueue.ownerName}`});

            serverQueue.msg?.edit({embeds: [playingEmbed]});
        }

        async function stop()
        {
            if (connection) connection.destroy();
            if (audioPlayer) audioPlayer.stop();

            const embedMessage = serverQueue.msg;
            
            await embedMessage?.edit({embeds: [endedEmbed]});
            serverQueue = Object.assign({}, defaultQueue);
            serverQueue.queue = [];

            queueList.delete(guild.id);

            setTimeout(async () => {
                embedMessage?.delete();
            }, 5000);

            return;
        }

    }
}

interface queue {
    owner: string,
    ownerName: string,
    vc: string,
    text?: TextBasedChannel,
    msg?: Message<boolean>,
    queue: queueEntry[],
    skipVotes: string[],
}

interface queueEntry {
    url: string,
    name: string,
    author: string,
    authorUrl: string,
    length: string,
    img: string,
    requester: string,
    requesterIcon: string | null,
}