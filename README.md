<div align="center">
  <img src="https://github.com/user-attachments/assets/972300ff-fd66-41e1-b86c-bc59cf72e133" height="100px">
  <h2>Convert YouTube videos into custom MP3 albums</h2>
</div>

# About 

**yt2lp** is a CLI tool that allows you to convert a YouTube video into a set of MP3 files based on the videos timestamps

# Install

To install the CLI, run the setup script
```
./setup
```

# Usage

## Running the Tool

To pull up all options, run 
```
yt2lp --help
```
To convert a video, run 
```
yt2lp [youtube url]
```
To add metadata to the video, you can use flags `--artist`, `--album`, `--year`, and `--genre`
```
yt2lp [youtube url] --artist="[artist]" --album="[album]" --year="[year]" --genre="[genre]"
```
Videos without timestamps in the description will be processed as a single audio file &ndash; use the `--timestamps` flag to set your own timestamps
```
yt2lp [youtube url] --timestamps="[timestamps]"
```

Timestamps should be passed in the format of `XX:XX [Song Name] XX:XX [Song Name]` etc...

You can also place your timestamps in a `.txt` file and input the filepath using the `--timestamps` flag

## Usage with Apple Music 
To upload the albums you convert onto your Apple Music account, open the app on yout desktop, open the *Recently Added* tab, and drag your album folder into the *Recently Added* page

**NOTE**: if you pass an album name and artist name that match an existing album in your library, Apple Music will add the new songs to the existing album

## Usage with Spotify
To upload the albums you convert onto your Spotify Account, you must first allow local files

On the Spotify desktop app, navigate to Settings > Your Library and turn *Show Local Files* on

Next, find *Show songs from*, click *Add Source*, and select the folder with your album

More information about uploading local files to Spotify can be found [here](https://support.spotify.com/us/article/local-files/)

# Future Updates
In future updates, support for multiple videos and YouTube playlists will be added

