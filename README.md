# ARCompanion

[![CI](https://github.com/michenriksen/arcompanion/actions/workflows/ci.yml/badge.svg)](https://github.com/michenriksen/arcompanion/actions/workflows/ci.yml)
[![Deploy](https://github.com/michenriksen/arcompanion/actions/workflows/deploy.yml/badge.svg)](https://github.com/michenriksen/arcompanion/actions/workflows/deploy.yml)

A companion web application for ARC Raiders that helps you focus on the crafting materials you need for your favorite equipment and what to salvage and recycle to get them.

## Features

- **Material Tracking**: Bookmark desired items and see all required crafting materials in one place
- **Smart Prioritization**: Visual scoring system shows which items to salvage or recycle for the best yield
- **Dual-Mode Scoring**: Separate salvage and recycle scores based on material demand, weight, and output diversity
- **Item Database**: Browse and search all ARC Raiders items with detailed information
- **Flexible Filtering**: Choose between Maximum Yield or Weight Conscious optimization modes

## How It Works

ARCompanion analyzes your bookmarked equipment and calculates which loot items provide the materials you need most efficiently. Items are scored for both salvaging (immediate materials from lightweight items) and recycling (diverse materials from rarer items), then automatically categorized based on which method gives the best yield.

## Data Sources

- **Item Data**: [RaidTheory/arcraiders-data](https://github.com/RaidTheory/arcraiders-data)
- **Item Icons**: [Arc Raiders Wiki](https://arc-raiders.fandom.com/wiki/Arc_Raiders_Wiki)

The application is built with SvelteKit and runs entirely in the browser with a client-side SQLite database for fast, offline-capable item lookups.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start development server
npm run build        # Create production build
npm run db:build     # Rebuild database from latest ARC Raiders data
```
