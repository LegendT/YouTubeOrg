#!/usr/bin/env python3
import re
from html.parser import HTMLParser

class WatchHistoryParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.videos = []
        self.current_video = {}
        self.in_content_cell = False
        self.current_data = []
        self.cell_count = 0

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == 'div' and 'class' in attrs_dict:
            if 'content-cell' in attrs_dict['class'] and 'mdl-cell--6-col' in attrs_dict['class']:
                self.in_content_cell = True
                self.cell_count += 1
                self.current_data = []
        elif tag == 'a' and self.in_content_cell and 'href' in attrs_dict:
            if 'youtube.com/watch' in attrs_dict['href'] or 'youtube.com/post' in attrs_dict['href']:
                self.current_video['url'] = attrs_dict['href']
            elif 'youtube.com/channel' in attrs_dict['href']:
                self.current_video['channel_url'] = attrs_dict['href']

    def handle_data(self, data):
        if self.in_content_cell:
            self.current_data.append(data.strip())

    def handle_endtag(self, tag):
        if tag == 'div' and self.in_content_cell:
            self.in_content_cell = False
            data_text = ' '.join(self.current_data)

            # Check if this is the first content cell with video info
            if self.cell_count % 2 == 1 and self.current_video:
                # Extract the action (Watched, Viewed, etc.)
                if 'Watched ' in data_text:
                    self.current_video['action'] = 'Watched'
                elif 'Viewed ' in data_text:
                    self.current_video['action'] = 'Viewed'
                else:
                    # Check for other possible actions
                    for action in ['Subscribed', 'Liked', 'Commented']:
                        if action in data_text:
                            self.current_video['action'] = action
                            break

                # Extract title (between action and channel name)
                if 'url' in self.current_video:
                    # Find title in the data
                    parts = data_text.split('\n')
                    for part in parts:
                        part = part.strip()
                        if part and part not in ['Watched', 'Viewed', 'Subscribed', 'Liked', 'Commented']:
                            if not part.startswith('http') and len(part) > 3:
                                if 'title' not in self.current_video:
                                    self.current_video['title'] = part
                                elif 'channel' not in self.current_video and 'youtube.com' not in part:
                                    self.current_video['channel'] = part
                                elif 'GMT' in part:
                                    self.current_video['date'] = part

                # Save video if we have enough info
                if 'url' in self.current_video and 'action' in self.current_video:
                    self.videos.append(self.current_video.copy())
                    self.current_video = {}

# Read and parse the file
with open('/Users/anthonygeorge/Projects/YouTubeOrg/data/watch-history.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

parser = WatchHistoryParser()
parser.feed(html_content)

# Separate watched and not watched
watched_videos = [v for v in parser.videos if v.get('action') == 'Watched']
not_watched_videos = [v for v in parser.videos if v.get('action') != 'Watched']

print(f"Total videos: {len(parser.videos)}")
print(f"Watched videos: {len(watched_videos)}")
print(f"Not watched (Viewed, etc.): {len(not_watched_videos)}")
print("\n" + "="*80)
print("Videos that were NOT watched:")
print("="*80 + "\n")

for i, video in enumerate(not_watched_videos, 1):
    print(f"{i}. Action: {video.get('action', 'Unknown')}")
    print(f"   Title: {video.get('title', 'No title')}")
    print(f"   Channel: {video.get('channel', 'Unknown channel')}")
    print(f"   URL: {video.get('url', 'No URL')}")
    print(f"   Date: {video.get('date', 'No date')}")
    print()
