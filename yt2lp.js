#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn } from 'child_process';
import { genreNameToCode } from './genres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    url: null,
    help: false,
    artist: null,
    album: null,
    genre: null,
    description: null // New parameter for custom description
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      params.help = true;
    } else if (arg === '-a' || arg === '--artist') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith('-')) {
          params.artist = nextArg;
          i++;
        } else {
          console.error('Error: --artist option requires a name');
          process.exit(1);
        }
      } else {
        console.error('Error: --artist option requires a name');
        process.exit(1);
      }
    } else if (arg === '-A' || arg === '--album') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith('-')) {
          params.album = nextArg;
          i++;
        } else {
          console.error('Error: --album option requires a name');
          process.exit(1);
        }
      } else {
        console.error('Error: --album option requires a name');
        process.exit(1);
      }
    } else if (arg === '-g' || arg === '--genre') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith('-')) {
          params.genre = nextArg;
          i++;
        } else {
          console.error('Error: --genre option requires a name');
          process.exit(1);
        }
      } else {
        console.error('Error: --genre option requires a name');
        process.exit(1);
      }
    } else if (arg === '-d' || arg === '--description') {
      // Handle new description parameter
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith('-')) {
          params.description = nextArg;
          i++;
        } else {
          console.error('Error: --description option requires a text string');
          process.exit(1);
        }
      } else {
        console.error('Error: --description option requires a text string');
        process.exit(1);
      }
    } else if (!params.url && (arg.includes('youtube.com') || arg.includes('youtu.be'))) {
      params.url = arg;
    }
  }

  return params;
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

function checkYoutubeDl() {
  try {
    const result = execSync('which youtube-dl || which yt-dlp', { encoding: 'utf8' });
    return result.trim();
  } catch (error) {
    console.error('Error: youtube-dl or yt-dlp is not installed.');
    console.log('run ./setup.bash');
    process.exit(1);
  }
}

function checkFfmpeg() {
  try {
    execSync('which ffmpeg', { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error('Error: ffmpeg is not installed.');
    console.log('run ./setup.bash');
    process.exit(1);
  }
}

function timeToSeconds(timeString) {
  if (!timeString) return 0;
  
  if (timeString.startsWith('PT')) {
    const hours = timeString.match(/(\d+)H/);
    const minutes = timeString.match(/(\d+)M/);
    const seconds = timeString.match(/(\d+)S/);
    
    return (hours ? parseInt(hours[1]) * 3600 : 0) + 
           (minutes ? parseInt(minutes[1]) * 60 : 0) + 
           (seconds ? parseInt(seconds[1]) : 0);
  }
  
  if (timeString.includes(':')) {
    const parts = timeString.split(':').map(Number);
    
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }
  
  const seconds = parseFloat(timeString);
  if (!isNaN(seconds)) {
    return seconds;
  }
  
  console.error('Invalid time format:', timeString);
  return 0;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

async function downloadFullVideo(videoUrl, outputDir, ytdlPath) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(outputDir, `full_video_temp.mp3`);
    
    console.log("Downloading full video audio track...");
    
    const args = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--no-playlist',
      '--no-warnings',
      '--no-keep-video',
      '-o', tempFile
    ];
    
    const download = spawn(ytdlPath, args);
    let downloadOutput = '';
    
    download.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.log(output);
      }
    });
    
    download.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        console.error(`Error: ${output}`);
        downloadOutput += output + '\n';
      }
    });
    
    download.on('close', (code) => {
      if (code === 0) {
        console.log(`Full audio track downloaded successfully`);
        resolve(tempFile);
      } else {
        console.log("Retrying with simpler options...");
        
        const simpleArgs = [
          videoUrl,
          '-x',  
          '--audio-format', 'mp3',
          '--no-keep-video',
          '-o', tempFile
        ];
        
        const retryDownload = spawn(ytdlPath, simpleArgs);
        let retryOutput = '';
        
        retryDownload.stdout.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            console.log(output);
          }
        });
        
        retryDownload.stderr.on('data', (data) => {
          const output = data.toString().trim();
          if (output) {
            console.error(`Error: ${output}`);
            retryOutput += output + '\n';
          }
        });
        
        retryDownload.on('close', (retryCode) => {
          if (retryCode === 0) {
            console.log(`Full audio track downloaded successfully`);
            resolve(tempFile);
          } else {
            reject(new Error(`Failed to download audio`));
          }
        });
      }
    });
  });
}

// New function to update MP3 metadata
async function updateMp3Metadata(filePath, metadata) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }
    
    console.log(`Updating metadata for ${path.basename(filePath)}`);
    
    // Build ffmpeg arguments for metadata
    const args = [
      '-i', filePath,
      '-c:a', 'copy'  // Copy audio stream without re-encoding
    ];
    
    // Add metadata fields - song, artist, album and genre
    if (metadata.song) args.push('-metadata', `title=${metadata.song}`);
    if (metadata.artist) args.push('-metadata', `artist=${metadata.artist}`);
    if (metadata.album) args.push('-metadata', `album=${metadata.album}`);
    if (metadata.genre !== undefined) args.push('-metadata', `genre=${metadata.genre}`);
    
    // Create temporary output file
    const tempOutput = `${filePath}.temp.mp3`;
    args.push(tempOutput);
    
    // Log the command we're about to run
    console.log(`Adding metadata with ffmpeg...`);
    
    const ffmpeg = spawn('ffmpeg', args);
    
    ffmpeg.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) console.log(output);
    });
    
    ffmpeg.stderr.on('data', (data) => {
      // ffmpeg outputs progress to stderr, so we don't treat all of it as errors
      const output = data.toString().trim();
      if (output && output.includes('error')) {
        console.error(`Error: ${output}`);
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // Replace original file with the one containing updated metadata
        fs.unlinkSync(filePath);
        fs.renameSync(tempOutput, filePath);
        console.log(`Successfully updated metadata`);
        resolve();
      } else {
        // Clean up temp file if it exists
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
        reject(new Error(`ffmpeg process exited with code ${code}`));
      }
    });
  });
}

// Updated to include metadata support
async function extractAudioSection(fullAudioPath, outputPath, startTime, endTime, metadata = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const startSeconds = timeToSeconds(startTime);
      const endSeconds = timeToSeconds(endTime);
      const duration = endSeconds - startSeconds;
      
      if (duration <= 0) {
        reject(new Error(`Invalid time range: ${startTime} to ${endTime}`));
        return;
      }
      
      console.log(`Extracting segment from ${startTime} to ${endTime}`);
      
      let finalOutputPath = outputPath;
      if (finalOutputPath.includes('%(ext)s')) {
        finalOutputPath = finalOutputPath.replace(/\.\%\(ext\)s$/, '.mp3');
      } else if (!finalOutputPath.endsWith('.mp3')) {
        finalOutputPath += '.mp3';
      }
      
      const outputDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const ffmpegCommand = `ffmpeg -i "${fullAudioPath}" -ss ${startSeconds} -t ${duration} -vn -acodec libmp3lame -q:a 2 "${finalOutputPath}" -y`;
      
      execSync(ffmpegCommand, { 
        encoding: 'utf8',
        stdio: 'inherit',
        maxBuffer: 10 * 1024 * 1024 
      });
      
      console.log(`Successfully extracted section`);
      
      // Apply metadata if provided
      if (metadata) {
        try {
          await updateMp3Metadata(finalOutputPath, metadata);
        } catch (metadataError) {
          console.error(`Warning: Failed to update metadata: ${metadataError.message}`);
          // Continue despite metadata error - we still have the audio file
        }
      }
      
      resolve(finalOutputPath);
    } catch (error) {
      console.error("Error extracting audio section:", error.message);
      reject(error);
    }
  });
}

function getVideoInfoFromYoutubeDl(videoUrl, ytdlPath) {
  try {
    console.log(`Getting video info from youtube-dl for ${videoUrl}`);
    
    const result = execSync(`${ytdlPath} --dump-json --no-playlist "${videoUrl}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });
    
    const info = JSON.parse(result);
    
    // Return an expanded object with channel information if available
    return {
      id: info.id,
      snippet: {
        title: info.title,
        description: info.description,
        channelTitle: info.uploader || info.channel || "Unknown Artist", // Add channel info
        publishedAt: info.upload_date || null // Add upload date if available
      },
      contentDetails: {
        duration: info.duration
      }
    };
  } catch (error) {
    console.error("Error fetching video info from youtube-dl:", error.message);
    throw error;
  }
}

function parseDescription(description) {
  if (!description) {
    console.log("No description provided to parse");
    return [];
  }
  
  console.log("Parsing description for timestamps...");
  
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
      console.log(`Found ${matches.length} timestamps using pattern`);
      break;
    }
  }
  
  matches.sort((a, b) => a.seconds - b.seconds);
  return matches;
}

async function main() {
  try {
    const params = parseArgs();
    if (params.help || !params.url) {
      showHelp();
      process.exit(params.help ? 0 : 1);
    }
        
    const ytdlPath = checkYoutubeDl();
    checkFfmpeg();

    const outputDir = path.join(process.env.HOME, "Documents");
    
    const videoUrl = params.url;
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = videoUrl.match(regex);
    const videoId = match ? match[1] : null;
    if (!videoId) {
      console.error("Invalid YouTube URL");
      process.exit(1);
    }
    
    let metadata;
    try {
      metadata = await getVideoInfoFromYoutubeDl(videoUrl, ytdlPath);
    } catch (ytdlError) {
      console.error("Failed to get video info:", ytdlError.message);
      throw new Error("Could not get video information. Please check the URL and try again.");
    }
    
    const videoTitle = metadata.snippet.title;
    const channelName = metadata.snippet.channelTitle;
    
    // Format upload date if available (often in YYYYMMDD format)
    let uploadYear = new Date().getFullYear().toString(); // Default to current year
    if (metadata.snippet.publishedAt) {
      if (metadata.snippet.publishedAt.length >= 4) {
        uploadYear = metadata.snippet.publishedAt.substring(0, 4);
      }
    }
    
    // Use album name as folder name
    const albumName = params.album || videoTitle;
    const folderName = albumName.replace(/[^\w\s]/gi, '').trim();
    
    const baseOutputDir = path.join(outputDir, folderName);
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }
    
    // Set up metadata defaults
    const artistName = params.artist || channelName;
    
    // Handle genre properly using the genreNameToCode function
    let genreCode = undefined;
    if (params.genre) {
      genreCode = genreNameToCode(params.genre);
      console.log(`Genre "${params.genre}" mapped to code: ${genreCode}`);
    }
    
    // Use custom description if provided, otherwise use video description
    const descriptionToUse = params.description || metadata.snippet.description;
    console.log("Using " + (params.description ? "custom description" : "video description") + " for timestamps");
    
    const timestamps = parseDescription(descriptionToUse);
    const fullAudioPath = await downloadFullVideo(videoUrl, baseOutputDir, ytdlPath);
    
    if (timestamps.length === 0) {
      console.log("No timestamps found in description. The full audio has been downloaded.");
      
      // Update metadata for the full audio
      const fullAudioMetadata = {
        song: videoTitle,
        artist: artistName,
        album: albumName,
        genre: genreCode // Use the correct genre code
      };
      
      try {
        await updateMp3Metadata(fullAudioPath, fullAudioMetadata);
        // Rename the file to have a nicer name if it's the full video
        const cleanTitle = videoTitle.replace(/[^\w\s]/gi, '').trim();
        const renamedPath = path.join(baseOutputDir, `${cleanTitle}.mp3`);
        fs.renameSync(fullAudioPath, renamedPath);
        console.log(`Full audio saved as: ${path.basename(renamedPath)}`);
      } catch (metadataError) {
        console.error(`Warning: Failed to update metadata: ${metadataError.message}`);
      }
      
      return;
    }
        
    for (let i = 0; i < timestamps.length; i++) {
      const { title, timestamp, seconds } = timestamps[i];
      
      let endTime;
      if (i < timestamps.length - 1) {
        endTime = timestamps[i + 1].timestamp;
      } else {
        const durationInSeconds = metadata.contentDetails.duration;
        endTime = formatTime(durationInSeconds);
      }
      
      const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
      const outputPath = path.join(baseOutputDir, `${cleanTitle}.mp3`);
      console.log(`Extracting section ${i+1}/${timestamps.length}: "${cleanTitle}"`);
      
      // Create metadata for this track
      const trackMetadata = {
        song: title,
        artist: artistName,
        album: albumName,
        genre: genreCode
      };
      
      try {
        await extractAudioSection(fullAudioPath, outputPath, timestamp, endTime, trackMetadata);
        console.log(`Track ${i+1} saved with metadata`);
      } catch (error) {
        console.error(`Failed to extract section "${cleanTitle}": ${error.message}`);
      }
    }
    
    console.log("Cleaning up temporary files...");
    
    if (fs.existsSync(fullAudioPath)) {
      fs.unlinkSync(fullAudioPath);
    }
    
    const files = fs.readdirSync(baseOutputDir);
    for (const file of files) {
      if (file.includes('full_video_temp') || file.includes('.webm') || file.includes('.part') || file.includes('.temp')) {
        const filePath = path.join(baseOutputDir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`Removed temporary file: ${file}`);
        } catch (error) {
          console.error(`Error removing ${file}: ${error.message}`);
        }
      }
    }
    
    console.log("All downloads complete with metadata!");
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});