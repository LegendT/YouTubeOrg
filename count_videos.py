#!/usr/bin/env python3
import os
import csv

playlists_dir = '/Users/anthonygeorge/Projects/YouTubeOrg/data/Playlists/'
total_videos = 0
playlist_counts = []

for filename in os.listdir(playlists_dir):
    if filename.endswith('-videos.csv'):
        filepath = os.path.join(playlists_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                # Count lines minus header
                count = sum(1 for line in f) - 1
                if count > 0:  # Only count non-empty playlists
                    total_videos += count
                    playlist_counts.append((filename.replace('-videos.csv', ''), count))
        except Exception as e:
            print(f"Error reading {filename}: {e}")

# Sort by video count descending
playlist_counts.sort(key=lambda x: x[1], reverse=True)

print(f"Total playlists: {len(playlist_counts)}")
print(f"Total videos (with duplicates): {total_videos:,}")
print(f"\nTop 20 playlists by video count:")
print("-" * 50)
for name, count in playlist_counts[:20]:
    print(f"{count:5,} - {name}")
