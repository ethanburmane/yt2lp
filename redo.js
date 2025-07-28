#!/usr/bin/env node

import fs from 'fs';
import path from 'path';


function parseArgs() {
    const args = process.argv.slice(2);
    const params = {
        url: null,
        artist: null,
        album: null,
        genre: null,
        description: null,
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-h' || arg === '--help') {
            showHelp();
            break;
        } 
    }
}

function showHelp() {
  console.log(`
USAGE:
  yt2lp [OPTIONS] <youtube-url>

OPTIONS:
  -h, --help                Show this help message
  -a, --artist <name>       Set the artist name
  -A, --album <name>        Set the album name
  -g, --genre <name>        Set the genre
  -d, --description <text/filepath>  Provide custom timestamp text or filepath to a .txt file

EXAMPLES:
  yt2lp https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt2lp --artist "Radiohead" --album "From The Basement: In Rainbows" --genre "Alternative" https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt2lp --description "0:00 Song1, 1:24 Song2, 5:32 Song3" https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt2lp --description timestamps.txt https://www.youtube.com/watch?v=DWuAn6C8Mfc

  
NOTE:
  Audio files will be saved to \${ROOT_AUDIO_FOLDER}/<album-name>/<song-name>.mp3
  `);
}

async function handler() {
    // check root variable
    const rootAudioFolder = process.env($ROOT_AUDIO_FOLDER);



    const params = parseArgs();

}