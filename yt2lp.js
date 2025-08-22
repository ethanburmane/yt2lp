import YTDlpWrapModule from 'yt-dlp-wrap';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { genreMapping } from './genre.js';

const YTDlpWrap = YTDlpWrapModule.default;
const ytdlp = new YTDlpWrap();

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const NC = '\x1b[0m';

const YT2LP_OUTPUT_DIR = process.env.YT2LP_OUTPUT_DIR;
if (!YT2LP_OUTPUT_DIR) {
    console.log(RED + "YT2LP_OUTPUT_DIR variable must be set" + NC);
    process.exit(1);
}

function showHelp() {
  console.log(`
YouTube to LP - Convert YouTube videos and playlists to MP3 files with metadata

Usage:
  yt2lp [options] <youtube-url>

Options:
  -h, --help                Show this help message
  -a, --artist <name>       Set the artist name
  -A, --album <name>        Set the album name
  -g, --genre <name>        Set the genre
  -d, --description <text>  Provide custom timestamp text (for when video description lacks timestamps)

Examples:
  yt2lp https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt2lp --artist "Radiohead" --album "From The Basement: In Rainbows" --genre "Alternative" https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt2lp --description "0:00 Intro, 1:24 First Song, 5:32 Second Song" https://www.youtube.com/watch?v=DWuAn6C8Mfc

  
Note:
  Audio files will be saved to ~/Documents/<folder name>/<song name>.mp3
  `);
}

function parseArgs() {
    const args = process.argv.slice(2);

    // check youtube url
    const url = args[0];
    if (!url) {
        console.log(RED + "You must input a YouTube URL" + NC);
        return null;
    }
    const isValidUrl = url.match(/^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/gm);
    if (!isValidUrl) {
        console.log(RED + "You must pass a valid YouTube url" + NC);
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
        if (flag === '--help' || flag === '-h') {
            return flag;
        } else if (flag === '--artist' || flag === '-a') {
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
        console.log(RED + "No description provided" + NC);
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
            console.log(GREEN + `${matches.length} timestamps found` + NC);
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
    } else if (args === '--help' || args === '-h') {
        showHelp();
        return;
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
        console.log(RED + `Error getting video data: ${error}` + RED);
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
        console.log(YELLOW + "No timestamps found - exporting as full audio" + NC);
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
        console.log(GREEN + "Full audio file successfully downloaded" + NC);
    } catch (error) {
        console.log(RED + `Error getting the full audio file: ${error}` + NC);
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
            console.log(RED + `${albumFolderPath} already exists. Please choose another album name and try again.` + NC)
        } else {
            console.log(RED + `Could not make album folder: ${error}` + NC);
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
            console.log(GREEN + `${timestamp.title} successfully extracted!` + NC);
        } catch (error) {
            console.log(RED + `Error extracting ${timestamp.title}: ${error}` + NC);
        }
    });

    // wait for all songs to be processed
    await Promise.all(promises);
    console.log(GREEN + 'Album successfully converted!' + NC);
}

main();