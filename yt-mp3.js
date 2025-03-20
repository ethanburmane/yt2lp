#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync, spawn } from 'child_process';
import dotenv from 'dotenv';

// For proper file paths in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

// Parse command line arguments
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
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        params.title = args[++i];
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

// Show help
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
  YouTube API key should be stored in .env file as YOUTUBE_API_KEY=your_key
  `);
}

// Check if youtube-dl is installed
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

// Check if ffmpeg is installed
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

// Parse timestamp in various formats to seconds
function timeToSeconds(timeString) {
  if (!timeString) return 0;
  
  // Handle YouTube duration format (PT1H2M3S)
  if (timeString.startsWith('PT')) {
    const hours = timeString.match(/(\d+)H/);
    const minutes = timeString.match(/(\d+)M/);
    const seconds = timeString.match(/(\d+)S/);
    
    return (hours ? parseInt(hours[1]) * 3600 : 0) + 
           (minutes ? parseInt(minutes[1]) * 60 : 0) + 
           (seconds ? parseInt(seconds[1]) : 0);
  }
  
  // Handle colon-separated format (HH:MM:SS or MM:SS)
  if (timeString.includes(':')) {
    const parts = timeString.split(':').map(Number);
    
    if (parts.length === 3) {
      // Format: HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      // Format: MM:SS
      return parts[0] * 60 + parts[1];
    }
  }
  
  // Try to parse as a simple number of seconds
  const seconds = parseFloat(timeString);
  if (!isNaN(seconds)) {
    return seconds;
  }
  
  console.error('Invalid time format:', timeString);
  return 0;
}

// Format seconds to HH:MM:SS
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

// Download a complete video first, then use ffmpeg to extract sections
async function downloadFullVideo(videoUrl, outputDir, ytdlPath) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(outputDir, `full_video_temp.mp3`);
    
    console.log("Downloading full video audio track...");
    
    // Build command with format options that work with both youtube-dl and yt-dlp
    const args = [
      videoUrl,
      '--extract-audio',
      '--audio-format', 'mp3',  // Use mp3 which is widely supported
      '--audio-quality', '0',
      '--no-playlist',
      '--no-warnings',
      '--no-keep-video',  // Don't keep the video file
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
        // Try with different options if first attempt failed
        console.log("Retrying with simpler options...");
        
        const simpleArgs = [
          videoUrl,
          '-x',  // Extract audio
          '--audio-format', 'mp3',
          '--no-keep-video', // Don't keep the video file
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

// Extract a section from the full audio file
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
      
      // Ensure the output path has .mp3 extension
      let finalOutputPath = outputPath;
      if (finalOutputPath.includes('%(ext)s')) {
        finalOutputPath = finalOutputPath.replace(/\.\%\(ext\)s$/, '.mp3');
      } else if (!finalOutputPath.endsWith('.mp3')) {
        finalOutputPath += '.mp3';
      }
      
      // Create output directory if it doesn't exist
      const outputDir = path.dirname(finalOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Build ffmpeg command
      const ffmpegCommand = `ffmpeg -i "${fullAudioPath}" -ss ${startSeconds} -t ${duration} -vn -acodec libmp3lame -q:a 2 "${finalOutputPath}" -y`;
      
      execSync(ffmpegCommand, { 
        encoding: 'utf8',
        stdio: 'inherit',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      console.log(`Successfully extracted section`);
      resolve(finalOutputPath);
    } catch (error) {
      console.error("Error extracting audio section:", error.message);
      reject(error);
    }
  });
}

// Fetch video info using youtube-dl
function getVideoInfoFromYoutubeDl(videoUrl, ytdlPath) {
  try {
    console.log(`Getting video info from youtube-dl for ${videoUrl}`);
    
    // Use --dump-json to get metadata in JSON format
    const result = execSync(`${ytdlPath} --dump-json --no-playlist "${videoUrl}"`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
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

// Parse video description for timestamps
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
      
      // Convert timestamp to seconds for sorting
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
  
  // Sort by timestamp
  matches.sort((a, b) => a.seconds - b.seconds);
  return matches;
}

// Get video info from YouTube API
async function getVideoInfoFromApi(videoId, apiKey) {
  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,contentDetails,statistics,status`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return data.items[0];
    } else {
      throw new Error("No video found with the provided ID");
    }
  } catch (error) {
    console.error("Error fetching video metadata from API:", error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    // Parse command line arguments
    const params = parseArgs();
    
    // Show help and exit if requested
    if (params.help || !params.url) {
      showHelp();
      process.exit(params.help ? 0 : 1);
    }
    
    console.log("Starting YouTube to MP3 downloader");
    
    // Load API key from environment variables
    const apiKey = process.env.YOUTUBE_API_KEY;
    
    // Find youtube-dl or yt-dlp executable
    const ytdlPath = checkYoutubeDl();
    
    // Check if ffmpeg is installed
    checkFfmpeg();
    
    // Define output directory (always in Documents)
    const outputDir = path.join(process.env.HOME, "Documents");
    
    // Get the video ID from URL
    const videoUrl = params.url;
    const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = videoUrl.match(regex);
    const videoId = match ? match[1] : null;
    
    if (!videoId) {
      console.error("Invalid YouTube URL");
      process.exit(1);
    }
    
    // Get metadata - try with youtube-dl first
    let metadata;
    try {
      metadata = await getVideoInfoFromYoutubeDl(videoUrl, ytdlPath);
    } catch (ytdlError) {
      console.log("Trying YouTube API...");
      if (!apiKey) {
        console.error("YouTube API key not found in .env file. Create a .env file with YOUTUBE_API_KEY=your_key");
        process.exit(1);
      }
      try {
        metadata = await getVideoInfoFromApi(videoId, apiKey);
      } catch (apiError) {
        throw new Error("Could not get video information");
      }
    }
    
    const videoTitle = metadata.snippet.title;
    console.log(`Video title: ${videoTitle}`);
    
    // Use custom title if provided, otherwise clean video title for folder name
    let folderName;
    if (params.title) {
      folderName = params.title.trim();
      console.log(`Using custom folder name: ${folderName}`);
    } else {
      folderName = videoTitle.replace(/[^\w\s]/gi, '').trim();
    }
    
    // Create base directory for output
    const baseOutputDir = path.join(outputDir, folderName);
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }
    
    // Parse timestamps from description
    const timestamps = parseDescription(metadata.snippet.description);
    console.log(`Found ${timestamps.length} sections to download`);
    
    // First download the complete audio track
    console.log("Downloading the complete audio track...");
    const fullAudioPath = await downloadFullVideo(videoUrl, baseOutputDir, ytdlPath);
    
    if (timestamps.length === 0) {
      console.log("No timestamps found in description. The full audio has been downloaded.");
      return;
    }
    
    // Extract each section from the full audio file
    console.log("Extracting individual sections...");
    
    for (let i = 0; i < timestamps.length; i++) {
      const { title, timestamp, seconds } = timestamps[i];
      
      // Determine end time - either next timestamp or end of video
      let endTime;
      if (i < timestamps.length - 1) {
        endTime = timestamps[i + 1].timestamp;
      } else {
        // For the last segment, use the video duration
        const durationInSeconds = metadata.contentDetails.duration;
        endTime = formatTime(durationInSeconds);
      }
      
      // Clean the title for use as filename
      const cleanTitle = title.replace(/[^\w\s]/gi, '').trim();
      const outputPath = path.join(baseOutputDir, `${cleanTitle}.mp3`);
      
      console.log(`Extracting section ${i+1}/${timestamps.length}: "${cleanTitle}"`);
      
      try {
        await extractAudioSection(fullAudioPath, outputPath, timestamp, endTime);
      } catch (error) {
        console.error(`Failed to extract section "${cleanTitle}": ${error.message}`);
      }
    }
    
    // Clean up all temporary files
    console.log("Cleaning up temporary files...");
    
    // Remove full audio MP3
    if (fs.existsSync(fullAudioPath)) {
      fs.unlinkSync(fullAudioPath);
    }
    
    // Look for and remove any .webm or other temp files
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

// Run the main function
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});