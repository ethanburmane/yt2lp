import YTDlpWrapModule from 'yt-dlp-wrap';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { genreMapping } from './genre.js';

const YTDlpWrap = YTDlpWrapModule.default;
const ytdlp = new YTDlpWrap();

const red = '\x1b[31m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

const YT2LP_OUTPUT_DIR = process.env.YT2LP_OUTPUT_DIR;
if (!YT2LP_OUTPUT_DIR) {
    console.log(red + "YT2LP_OUTPUT_DIR variable must be set" + reset);
    process.exit(1);
}

function parseArgs() {
    const args = process.argv.slice(2);

    // check youtube url
    const url = args[0];
    if (!url) {
        console.log(red + "You must input a YouTube URL" + reset);
        return null;
    }
    const isValidUrl = url.match(/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm);
    if (!isValidUrl) {
        console.log(red + "You must pass a valid YouTube url" + reset);
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

function getGenreCode(genre) {
    // normalize the genre input
    genre = genre.toLowerCase().trim();
    genre = genre.replace(/[-_ ]/g, ' ');
    genre = genre.replace(/&/g, 'and');

    // check if the genre exists in the mapping
    if (genre in genreMapping) {
        return genreMapping[genre];
    } else {
        return null;
    }
}

function parseDescription(description, duration) {    
    if (!description) {
        console.log(red + "No description provided" + reset);
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
    let trackNum = 1;
    
    // find each pattern match 
    for (const pattern of patterns) {
        const patternMatches = [];
        
        while ((match = pattern.exec(description)) !== null) {
            const hasTimestampFirst = /^\d+:\d+/.test(match[1]);
            const timestamp = hasTimestampFirst ? match[1] : match[2];
            const title = hasTimestampFirst ? match[2] : match[1];
            
            const start = timeToSeconds(timestamp);
            const end = null;
            
            patternMatches.push({
                title: title.trim(),
                start,
                end,
                track: trackNum++
            });
        }
    
        if (patternMatches.length > 0) {
            matches = patternMatches;
            console.log(green + `${matches.length} timestamps found` + reset);
            break;
        }
    }

    // set end times for each section
    matches.forEach((match, index) => {
        if (index + 1 === matches.length) {
            match.end = duration;
        } else {
            match.end = matches[index + 1].start;
        }
    });
    
    matches.sort((a, b) => a.seconds - b.seconds);
    return matches;
}

async function extractAudioSection(fullAudioFile, songMetadata, albumFolderPath) {

    return new Promise((resolve, reject) => {

        const args = [
            '-i', fullAudioFile,
            '-ss', songMetadata.start.toString(),
            '-to', songMetadata.end.toString(),
            '-vn',
            '-acodec', 'libmp3lame',
            '-q:a', '2',
        ];

        // set metadata
        if (songMetadata.song) args.push('-metadata', `title=${songMetadata.song}`);
        if (songMetadata.album) args.push('-metadata', `album=${songMetadata.album}`);
        if (songMetadata.artist) args.push('-metadata', `artist=${songMetadata.artist}`);
        if (songMetadata.genre) args.push('-metadata', `genre=${songMetadata.genre}`);
        if (songMetadata.track) args.push('-metadata', `track=${songMetadata.track}/${songMetadata.totalTracks}`);

        // generate song audio file path
        const cleanSong = songMetadata.song.replace(/[^\w\s]/gi, '').trim();
        const songAudioPath = path.join(albumFolderPath, `${cleanSong}.mp3`);

        args.push(songAudioPath);
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
                resolve(songAudioPath);
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
        console.log(`Converting ${videoInfo.title}...`);
    } catch (error) {
        console.log(red + `Error getting video data: ${error}` + red);
        process.exit(1);
    }

    // get genre code
    let genreCode = null;
    if (args.genre) {
        genreCode = await getGenreCode(args.genre);
    }

    // set album metadata
    const albumMetadata = {
        album: args.album || videoInfo.title || null,
        artist: args.artist || null,
        genre: genreCode || null,
        totalTracks: null
    };

    // set timestamps
    console.log("Searching for timestamps...");
    let timestamps = [];
    if (args.timestamps) {
        timestamps = parseDescription(args.timestamps, videoInfo.duration);
    } else {
        timestamps = parseDescription(videoInfo.description, videoInfo.duration);
    }

    // if no timestamps full audio will be saved
    if (timestamps.length === 0) {
        console.log(yellow + "No timestamps found - exporting as full audio" + reset);
        timestamps = [
            { title: albumMetadata.album, start: 0, end: videoInfo.duration }
        ];

    }
    albumMetadata.totalTracks = timestamps.length;

    // get audio file for full video
    console.log("Downloading full audio file");
    const tempDirPath = os.tmpdir();
    const cleanAlbum = albumMetadata.album.replace(/[^\w\s]/gi, '').trim();
    const fullAudioPath = path.join(tempDirPath, `${cleanAlbum}.mp3`);
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
        console.log(green + "Full audio file successfully downloaded" + reset);
    } catch (error) {
        console.log(red + `Error getting the full audio file: ${error}` + reset);
        process.exit(1);
    }

    // make directory to place audio files in
    const albumFolderPath = path.join(YT2LP_OUTPUT_DIR, cleanAlbum);

    // make album folder 
    try {
        console.log(`Album being saved at ${albumFolderPath}`);
        fs.mkdirSync(albumFolderPath);
    } catch (error) {
        if (error.contains('EEXIST')) {
            console.log(red + `${albumFolderPath} already exists. Please choose another album name and try again.` + reset)
        } else {
            console.log(red + `Could not make album folder: ${error}` + reset);
        }
        process.exit(1);
    }

    // separate audio file by timestamps
    const promises = timestamps.map(async (timestamp, index) => {
        console.log(`Processing track ${index + 1}: ${timestamp.title}`);
        
        // set song-specific metadata
        const songMetadata = {
            ...albumMetadata,
            song: timestamp.title,
            track: index + 1,
            start: timestamp.start,
            end: timestamp.end
        };

        try {
            await extractAudioSection(fullAudioPath, songMetadata, albumFolderPath);
            console.log(green + `${timestamp.title} successfully extracted!` + reset);
        } catch (error) {
            console.log(red + `Error extracting ${timestamp.title}: ${error}` + reset);
        }
    });

    // wait for all songs to be processed
    await Promise.all(promises);
    console.log(green + 'Album successfully converted!' + reset);
}

main();