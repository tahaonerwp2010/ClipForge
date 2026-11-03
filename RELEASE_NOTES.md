## What's new
- 36 new caption styles: 17 new Classic styles (Bubble Gum, Breaking News, Retro Wave, Horror Night, Handwritten Note, Pixel Quest and more), 13 new Dynamic styles with their own animations, and 6 new Behind-the-person styles.
- One "Caption style" button opens a picker with every style, with a green outline on the selected one. Every preview now shows a person so you can see how the caption looks on a speaker.
- Fixed: Crimson Punch Outline now shows in the phone preview, and Cyber Glitch Split now shows its preview.
- Preview now matches the exported clip: hook, banner, watermark and caption sizes are calculated per font, exactly like the video renderer does.
- Fixed "Failed to configure input pad on Parsed_crop_1" (Generation failed while rendering clips) that happened with long clips and auto reframing.
- Your project now continues after a crash or power cut instead of starting again from step 1.
- Fixes for video downloads, projects deleting each other's clips, and the Open folder button.

- YouTube downloader hardened: tries every YouTube route over IPv4 and dual-stack (and your browser's sign-in as a last resort) before giving up, uses the fresh nightly yt-dlp, and shows an accurate reason (bot check / private / unavailable / network) instead of a false "slow internet".
