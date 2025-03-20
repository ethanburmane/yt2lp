#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    url: null,
    help: false,
    title: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '-h' || arg === '--help') {
      params.help = true;
    } else if (arg === '-t' || arg === '--title') {
      if (i + 1 < args.length) {
        const nextArg = args[i + 1];
        if (!nextArg.startsWith('-')) {
          params.title = nextArg;
          i++;
        } else {
          console.error('Error: --title option requires a folder name');
          process.exit(1);
        }
      } else {
        console.error('Error: --title option requires a folder name');
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
YouTube to MP3 Downloader - Extract songs from YouTube videos

Usage:
  yt-mp3 [options] <youtube-url>

Options:
  -h, --help                Show this help message
  -t, --title <foldername>  Use custom folder name instead of video title

Examples:
  yt-mp3 https://www.youtube.com/watch?v=DWuAn6C8Mfc
  yt-mp3 --title "Radiohead Live" https://www.youtube.com/watch?v=DWuAn6C8Mfc
  
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
    console.log('Please install it with:');
    console.log('  brew install youtube-dl');
    console.log('or');
    console.log('  brew install yt-dlp');
    process.exit(1);
  }
}

function checkFfmpeg() {
  try {
    execSync('which ffmpeg', { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error('Error: ffmpeg is not installed.');
    console.log('Please install it with:');
    console.log('  brew install ffmpeg');
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

async function extractAudioSection(fullAudioPath, outputPath, startTime, endTime) {
  return new Promise((resolve, reject) => {
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
    
    return {
      id: info.id,
      snippet: {
        title: info.title,
        description: info.description
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
    let folderName;
    if (params.title) {
      folderName = params.title.trim();
    } else {
      folderName = videoTitle.replace(/[^\w\s]/gi, '').trim();
    }
    
    const baseOutputDir = path.join(outputDir, folderName);
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }
    
    const timestamps = parseDescription(metadata.snippet.description);
    const fullAudioPath = await downloadFullVideo(videoUrl, baseOutputDir, ytdlPath);
    
    if (timestamps.length === 0) {
      console.log("No timestamps found in description. The full audio has been downloaded.");
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
      
      try {
        await extractAudioSection(fullAudioPath, outputPath, timestamp, endTime);
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
    
    console.log("All downloads complete!");
    
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});