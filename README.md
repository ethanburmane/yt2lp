<div align="center">
  <img src="https://github.com/user-attachments/assets/c6309450-d03e-442b-9f01-aafada122510" height="100px">
  <h2>Convert YouTube videos into custom MP3 albums</h2>
</div>

# About 

**yt2lp** is a CLI tool that allows you to convert a YouTube video into a set of MP3 files based on the videos timestamps

# Install

To install the CLI, run the setup script in the directory
```
./setup
```
This will install the tool globaly on your machine

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
To add metadata to the video, you can use flags such as `artist`, `album`, `year`, and `genre`
```
yt2lp [youtube url] --artist="[artist]" --album="[album]" --year="[year]" --genre="[genre]"
```
Albums without timestamps in the description will not be processed &ndash; use the `timestamps` flag to set your own timestamps
```
yt2lp [youtube url] --timestamps="[timestamps]"
```

# Usage with Apple Music 
To upload the albums you convert onto your Apple Music account, open the app on yout desktop, open the *Recently Added* tab, and drag your album folder into the *Recently Added* page

# Usage with Spotify
To upload the albums you convert onto your Spotify Account, you must first allow local files

On the Spotify desktop app, navigate to Settings > Your Library and turn *Show Local Files* on

Next, find *Show songs from*, click *Add Source*, and select the folder with your album

More information about uploading local files to Spotify can be found [here](https://support.spotify.com/us/article/local-files/)
