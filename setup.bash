#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# header
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}YouTube to LP Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo

# check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo -e "Please install Node.js first: https://nodejs.org/"
    exit 1
fi

# check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    echo -e "Please install npm first."
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js and npm found"

# check if youtube-dl or yt-dlp is installed
if command -v youtube-dl &> /dev/null; then
    echo -e "${GREEN}✓${NC} youtube-dl found"
elif command -v yt-dlp &> /dev/null; then
    echo -e "${GREEN}✓${NC} yt-dlp found"
else
    echo -e "${YELLOW}Warning: Neither youtube-dl nor yt-dlp is installed.${NC}"
    echo -e "Would you like to install yt-dlp now? (y/n)"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        if command -v brew &> /dev/null; then
            echo "Installing yt-dlp using Homebrew..."
            brew install yt-dlp
        elif command -v apt-get &> /dev/null; then
            echo "Installing yt-dlp using apt..."
            sudo apt-get update
            sudo apt-get install -y python3-pip
            sudo pip3 install yt-dlp
        else
            echo -e "${RED}Error: Could not determine how to install yt-dlp.${NC}"
            echo "Please install youtube-dl or yt-dlp manually and run this script again."
            exit 1
        fi
    else
        echo -e "${YELLOW}Warning: The tool won't work without youtube-dl or yt-dlp.${NC}"
        echo "Please install one of them manually before using the tool."
    fi
fi

# check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}Warning: ffmpeg is not installed.${NC}"
    echo -e "Would you like to install ffmpeg now? (y/n)"
    read -r answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
        if command -v brew &> /dev/null; then
            echo "Installing ffmpeg using Homebrew..."
            brew install ffmpeg
        elif command -v apt-get &> /dev/null; then
            echo "Installing ffmpeg using apt..."
            sudo apt-get update
            sudo apt-get install -y ffmpeg
        else
            echo -e "${RED}Error: Could not determine how to install ffmpeg.${NC}"
            echo "Please install ffmpeg manually and run this script again."
            exit 1
        fi
    else
        echo -e "${YELLOW}Warning: The tool won't work without ffmpeg.${NC}"
        echo "Please install ffmpeg manually before using the tool."
    fi
else
    echo -e "${GREEN}✓${NC} ffmpeg found"
fi

echo
echo -e "${GREEN}Installing npm dependencies...${NC}"
npm install

# make script executable
echo -e "${GREEN}Making yt-mp3.js executable...${NC}"
chmod +x yt-mp3.js

# install the tool globally
echo -e "${GREEN}Installing yt-mp3 globally...${NC}"
npm link

echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo
echo -e "You can now use the tool by running: ${YELLOW}yt-mp3 [youtube-url]${NC}"
echo -e "For help, run: ${YELLOW}yt-mp3 --help${NC}"
echo