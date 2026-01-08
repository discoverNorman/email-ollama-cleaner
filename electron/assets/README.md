# Electron App Icons

This directory should contain the application icons for the Electron build.

## Required Files

1. **icon.png** - Main app icon (512x512px or larger, square, PNG format)
2. **tray-icon.png** - System tray icon (16x16px or 32x32px, PNG format)

## Creating Icons

You can create icons using:
- **Design tools**: Figma, Adobe Illustrator, Inkscape
- **AI generation**: DALL-E, Midjourney, Stable Diffusion
- **Icon generators**: https://icon.kitchen/, https://www.appicon.co/

## Icon Guidelines

### Main App Icon (icon.png)
- Size: 512x512px (will be scaled down as needed)
- Format: PNG with transparency
- Design: Simple, recognizable, works at small sizes
- Theme: Email/trash/cleaning related (trash truck, envelope, etc.)

### Tray Icon (tray-icon.png)
- Size: 32x32px (or 16x16px, 48x48px)
- Format: PNG with transparency
- Design: Very simple, monochrome works best
- Should be recognizable at tiny sizes

## Temporary Workaround

Until you add proper icons, the app will work but may show default/missing icon placeholders.

To generate simple colored squares as temporary icons:

```bash
# Using ImageMagick (if installed)
convert -size 512x512 xc:#4F46E5 electron/assets/icon.png
convert -size 32x32 xc:#4F46E5 electron/assets/tray-icon.png

# Or use online tools like https://placeholder.com/
```

## Notes

- The electron-builder will automatically resize icon.png for all platforms
- macOS needs .icns, Windows needs .ico - electron-builder handles this
- tray-icon.png is used for the system tray notification area
