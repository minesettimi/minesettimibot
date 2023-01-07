import { VoiceConnectionStatus, entersState, joinVoiceChannel, VoiceConnection, getVoiceConnection, createAudioPlayer, AudioPlayer, AudioPlayerStatus, createAudioResource, StreamType} from '@discordjs/voice';
import { Channel, ChatInputCommandInteraction, EmbedBuilder, GuildMember, Message, SlashCommandBuilder, TextBasedChannel, User } from "discord.js";
import ytdl from "ytdl-core";
import ytdld from "ytdl-core-discord"
import yts from "yt-search"

const queueList = new Map<string, queue>;

const defaultQueue: queue =
{
    owner: "",
    ownerName: "",
    vc: "",
    queue: [],
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
        .addSubcommand(subcommand => subcommand.setName("skip").setDescription("Skips the current song playing on the bot.")),
    async execute(interaction : ChatInputCommandInteraction) {

        const member = interaction.member as GuildMember;
        if (member == null) return;

        const vc = member.voice.channel;
        if (vc == null) return await interaction.reply({content: "You must be in a vc to play music!", ephemeral: true});
        const vcChannel = vc.id;

        if (interaction.guild == null) return;
		const guild = interaction.guild;

        const channel = interaction.channel;
        if (!channel) return;

        let serverQueue: queue = queueList.get(guild.id) ?? Object.assign({}, defaultQueue);

        let connection: VoiceConnection | undefined = getVoiceConnection(guild.id);
        let audioPlayer: AudioPlayer | undefined;
        let message : Message;

        switch (interaction.options.getSubcommand())
        {
            case "play":
            {
                let video = interaction.options.getString("video", true);

                if (!ytdl.validateURL(video))
                {
                    const search = await yts(video);

                    if (search.videos.length > 0)
                        video = search.videos[0].url;
                    else
                        return interaction.reply({content: "Couldn't find a video with that url or name!", ephemeral: true});
                }

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

                if (serverQueue.owner === "")
                {
                    message = await interaction.channel.send({embeds: [initialEmbed]});

                    serverQueue.owner = member.id;
                    serverQueue.ownerName = member.user.tag;
                    serverQueue.vc = vcChannel;
                    serverQueue.text = interaction.channel;
                    serverQueue.msg = message;
                    createConnection();
                    playMusic();

                    await interaction.reply({content: `Started playing \`${title}\` by \`${author.name}\`.`, ephemeral: true});
                }
                else
                {
                    playingEmbed.spliceFields(-1, 1);
                    playingEmbed.addFields({name: 'Queue Remaining:', value: `${serverQueue.queue.length}`, inline: true});
                    serverQueue.msg?.edit({embeds: [playingEmbed]});

                	await interaction.reply({content: `Added \`${title}\` by \`${author.name}\` to the queue at position **${position}**.`, ephemeral: false});
            	}

                queueList.set(guild.id, serverQueue);

                break;
            }

            case "stop":
            {
                if (!connection)
                	return interaction.reply({content: "There is no active music bot in this server!", ephemeral: true});

                if (serverQueue.owner != member.id)
                	return interaction.reply({content: "You are not the current owner of the bot!", ephemeral: true});

                stop();

                await interaction.reply({content: "Stopped the music player.", ephemeral: true});

                break;
            }

            case "skip":
            {
                if (!connection)
                return interaction.reply({content: "There is no active music bot in this server!", ephemeral: true});

                if (serverQueue.owner != member.id)
                    return interaction.reply({content: "You are not the current owner of the bot!", ephemeral: true});

                audioPlayer?.stop();
                playMusic();

                await interaction.reply({content: "Skipped current song.", ephemeral: true});

                return;
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
                stop();
                return;
            }

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

        function stop()
        {
            if (connection) connection.destroy();
            if (audioPlayer) audioPlayer.stop()

            queueList.delete(guild.id);

            serverQueue.msg?.edit({embeds: [endedEmbed]})
            serverQueue = Object.assign({}, defaultQueue);

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
    queue: queueEntry[]
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