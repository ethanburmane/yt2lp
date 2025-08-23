<div align="center">
  <img src="https://github.com/user-attachments/assets/972300ff-fd66-41e1-b86c-bc59cf72e133" height="100px">
  <h2>Convert videos into custom MP3 albums</h2>
</div>

YT2LP (or yt2lp) is a command-line tool that takes a video URL, converts each section of the video into an MP3 file, and updates each MP3 with tracklist metadata -- essentially making an album from your video. This album can then be placed onto your streaming service to allow you to listen to your favorite live performance, unreleased album, or deep cut, on the go.</div>

<div align="center">

  <img src="https://github.com/user-attachments/assets/9e493344-b051-434c-86e6-2e080f280077">
  
</div>

# Installation

Start by cloning this repo and entering the directory
```
git clone https://github.com/ethanburmane/yt2lp && cd yt2lp
```

To install the CLI globally, run the setup script
```
./setup
```

# Usage

## Running the Tool

To convert a video, run
```
yt2lp [YouTube URL]
```

To set the album information, use the following flags
```
Options:
  -h, --help                      Show the help message
  -a, --artist [artist name]      Set the artist name
  -A, --album [album name]        Set the album name
  -y, --year [year]               Set the album year
  -g, --genre [genre]             Set the album genre
  -t, --timestamps [timestamps]   Set custom timestamps (pass in a string or a file path)
```

Videos without passed timestamps, or timestamps in the description, will be processed as a single audio file

For passing a string with the `--timestamps` flag, the format must be `XX:XX [song name] XX:XX [song name]` etc.

For passing a file path with the `--timestamps` flag, the file must have a `.txt` extension and follow the same format

**NOTE**: The video URL must be the first argument passed (with the exception of passing the `--help` flag)

## Usage with Apple Music 
To upload the albums you convert onto your Apple Music account, open the app on your desktop, open the *Recently Added* tab, and drag your album folder into the *Recently Added* page

**NOTE**: if you pass an album and artist name that exactly match an existing album in your library, Apple Music will add the new songs to the existing album

## Usage with Spotify
To upload the albums you convert onto your Spotify account, you must first allow local files

On the Spotify desktop app, navigate to Settings > Your Library and turn *Show Local Files* on

Next, find *Show songs from*, click *Add Source*, and select the folder with your album

More information about uploading local files to Spotify can be found [here](https://support.spotify.com/us/article/local-files/)

# Future Updates
In future updates, support for multiple input videos and playlists will be added

