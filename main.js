import YTDlpWrapModule from 'yt-dlp-wrap';
import os from 'os';
import path from 'path';

const YTDlpWrap = YTDlpWrapModule.default;
const ytdlp = new YTDlpWrap();
const tempDirPath = os.tmpdir();

const YT2LP_OUTPUT_DIR = process.env.YT2LP_OUTPUT_DIR;
if (!YT2LP_OUTPUT_DIR) {
    console.log("YT2LP_OUTPUT_DIR variable must be set");
    process.exit(1);
}

function parseArgs() {
    const args = process.argv.slice(2);

    // check youtube url
    const url = args[0];
    if (!url) {
        console.log("You must input a YouTube URL");
        return null;
    }
    const isValidUrl = url.match(/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm);
    if (!isValidUrl) {
        console.log("You must pass a valid YouTube url");
        return null;
    }

    // additional args 
    let artist = null;
    let album = null;
    let genre = null;
    let timestamps = null;

    // process flags
    const flags = args.slice(1);
    flags.forEach((flag, index) => {
        if (flag === '--artist' || flag === '-a') {
            artist = flags[index + 1];
        } else if (flag === '--album' || flag === '-A') {
            album = flags[index + 1];
        } else if (flag === '--genre' || flag === '-g') {
            genre = flags[index + 1];
        } else if (flag === '--timestamps' || flag === '-t') {
            timestamps = flags[index + 1];
        }
    })

    return {
        url: url,
        artist: artist,
        album: album,
        genre: genre,
        timestamps: timestamps
    };    
}

function timeToSeconds(time) {
    const parts = time.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1]; // minutes:seconds
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2]; // hours:minutes:seconds
    }
    throw new Error('Invalid time format');
}

function parseDescription(description) {
    if (!description) {
        console.log("No description provided");
        return [];
    }

    // timestamp formats
    const patterns = [
        /([^\n-]+)\s*-\s*(\d+:\d+(?::\d+)?)/g,
        /(\d+:\d+(?::\d+)?)\s+([^\n]+)/g,
        /(\d+:\d+(?::\d+)?)\s*-\s*([^\n]+)/g
    ];
    
    let matches = [];
    let match;
    
    for (const pattern of patterns) {
        const patternMatches = [];
        
        while ((match = pattern.exec(description)) !== null) {
        const hasTimestampFirst = /^\d+:\d+/.test(match[1]);
        const timestamp = hasTimestampFirst ? match[1] : match[2];
        const title = hasTimestampFirst ? match[2] : match[1];
        
        const seconds = timeToSeconds(timestamp);
        
        patternMatches.push({
            title: title.trim(),
            timestamp,
            seconds
        });
        }
    
        if (patternMatches.length > 0) {
        matches = patternMatches;
        console.log(`Found ${matches.length} timestamps`);
        break;
        }
    }
    
    matches.sort((a, b) => a.seconds - b.seconds);
    return matches;
}

async function extractAudioSection(fullAudioFile, songAudioFile, startTime, endTime, metadata) {

    return new Promise((resolve, reject) => {

        const args = [
            '-i', fullAudioFile,
            '-ss', startTime.toString(),
            '-to', endTime.toString(),
            '-vn',
            '-acodec', 'libmp3lame',
            '-q:a', '2',
        ];

        if (metadata.songName) args.push('-metadata', `title=${metadata.songName}`);
        if (metadata.albumName) args.push('-metadata', `album=${metadata.albumName}`);
        if (metadata.artistName) args.push('-metadata', `artist=${metadata.artistName}`);
        if (metadata.genreCode) args.push('-metadata', `genre=${metadata.genreCode}`);
        if (metadata.trackNumber) args.push('-metadata', `track=${metadata.trackNumber}/${metadata.totalTracks}`);

        args.push(songAudioFile);
        args.push('-y'); // overwrite output file if it exists

        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) console.log(output);
        });

        ffmpeg.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output && output.includes('error')) {
                reject(new Error(output));
            }
        });

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                resolve(songAudioFile);
            } else {
                reject(new Error(`ffmpeg process failed with code ${code}`));
            }
        });

        ffmpeg.on('error', (error) => {
            reject(error);
        });
    })
}

async function main() {

    // check output directory
    // check ytdlp
    // check ffmpeg

    // parse input arguments
    const args = parseArgs();
    if (!args) {
        process.exit(1);
    }

    // get video data
    let videoInfo;
    try {
        videoInfo = await ytdlp.getVideoInfo(args.url)
        if (!videoInfo) {
            return null;
        }
    } catch (error) {
        console.log('Error getting video data');
        process.exit(1);
    }

    // set album metadata
    const metadata = {
        album: args.album || videoInfo.title || null,
        artist: args.artist || null,
        genre: args.genre || null,
        timestamps: null,
        track: null,
        totalTracks: null
    };

    // set timestamps 
    let timestamps = [];
    if (args.timestamps) {
        timestamps = parseDescription(args.timestamps);
    } else {
        timestamps = parseDescription(videoInfo.description);
    }

    // if no timestamps full audio will be saved
    if (timestamps.length === 0) {
        timestamps = [
            { title: metadata.album, timestamp: '00:00', seconds: videoInfo.duration }
        ];
    }
    metadata.timestamps = timestamps;

    // get audio file for full video 
    const cleanAlbum = metadata.album.replace(/[^\w\s]/gi, '').trim();
    const fullAudioPath = path.join(tempDirPath, cleanAlbum);
    try {
        await ytdlp.execPromise([
            videoInfo.url,
            '-x',
            '--audio-format', 'mp3',
            '--output', fullAudioPath,
            '--no-warnings',
            '--no-check-certificate',
            '--prefer-free-formats',
        ]);
    } catch (error) {
        console.log('Error getting the full audio file');
        process.exit(1);
    }

    // separate audio file by timestamps
    metadata.timestamps.forEach(async (timestamp) => {
        const cleanSong = timestamp.title.replace(/[^\w\s]/gi, '').trim();
        const songAudioPath = path.join(tempDirPath, cleanSong);
        extractAudioSection
    });

}

main();