import type { PageLoad } from './$types.js';
import type { SongForPlayer } from '$lib/stores/playerStore.js'; // Assuming SongForPlayer exists for consistency

// Define a type for the playlist data structure expected from your API
export type PlaylistSummary = {
    id: string;
    name: string;
    image: { quality: string; url: string }[];
    url: string;
    songCount: string;
    description?: string;
};

// Define the shape of the data returned by the PageLoad function
export type PageData = {
    englishPlaylists: PlaylistSummary[];
    filipinoPlaylists: PlaylistSummary[];
    japanesePlaylists: PlaylistSummary[];
    featuredPlaylists: PlaylistSummary[]; // NEW: Featured playlists
    // You can keep the 'playlists' for general purpose if needed, or remove it
    // playlists: PlaylistSummary[];
};

export const load: PageLoad = async ({ fetch }) => {
    // --- Featured Playlists ---
    // These could be popular, trending, or hand-picked playlists.
    // Replace with actual JioSaavn playlist IDs/links you want to feature.
    const featuredPlaylistIds = [
        '9000007', // Example: "Trending Now"
        '9000008', // Example: "Workout Mix"
        '9000009', // Example: "Chill Vibes"
        '9000010', // Example: "Party Starters"
    ];

    // --- English Playlists ---
    // You can find JioSaavn playlist IDs or direct links for English songs by searching on Google.
    // Examples might include "International Hits", "Today's English Pop", "Workout English".
    // Replace these with actual IDs or links you find.
    const englishPlaylistIds = [
        '9000000', // Example: "Global Top 50"
        '9000001', // Example: "English Pop Hits"
        '9000002', // Example: "International Dance"
        // Add more English playlist IDs/links as you find them
    ];

    // --- Filipino Playlists ---
    // JioSaavn's focus is primarily Indian music. Finding extensive, dedicated Filipino playlists
    // might be challenging. Search on Google for "Filipino songs JioSaavn playlist" or
    // "OPM hits JioSaavn playlist" to find IDs/links if available.
    // These are placeholders; replace them with actual JioSaavn playlist IDs/links.
    const filipinoPlaylistIds = [
        '9000003', // Placeholder: "OPM Favorites"
        '9000004', // Placeholder: "Pinoy Rock"
    ];

    // --- Japanese Playlists ---
    // Similar to Filipino, dedicated Japanese playlists on JioSaavn might be rare.
    // Search on Google for "Japanese songs JioSaavn playlist" or "J-Pop hits JioSaavn playlist".
    // These are placeholders; replace them with actual JioSaavn playlist IDs/links.
    const japanesePlaylistIds = [
        '9000005', // Placeholder: "J-Pop Essentials"
        '9000006', // Placeholder: "Anime Themes"
    ];

    const fetchPlaylist = async (id: string): Promise<PlaylistSummary | null> => {
        try {
            // Your existing API endpoint for fetching playlist by ID
            const response = await fetch(`/api/playlist?id=${id}`);
            if (!response.ok) {
                console.warn(`Failed to fetch playlist with ID ${id}: ${response.statusText}`);
                return null;
            }
            const data = await response.json();
            return data; // Assuming data directly contains PlaylistSummary
        } catch (err) {
            console.error(`Error fetching playlist with ID ${id}:`, err);
            return null;
        }
    };

    // Fetch all playlists concurrently
    const [featuredResults, englishResults, filipinoResults, japaneseResults] = await Promise.all([
        Promise.all(featuredPlaylistIds.map(fetchPlaylist)),
        Promise.all(englishPlaylistIds.map(fetchPlaylist)),
        Promise.all(filipinoPlaylistIds.map(fetchPlaylist)),
        Promise.all(japanesePlaylistIds.map(fetchPlaylist)),
    ]);

    return {
        featuredPlaylists: featuredResults.filter(Boolean) as PlaylistSummary[], // NEW: Return featured playlists
        englishPlaylists: englishResults.filter(Boolean) as PlaylistSummary[],
        filipinoPlaylists: filipinoResults.filter(Boolean) as PlaylistSummary[],
        japanesePlaylists: japaneseResults.filter(Boolean) as PlaylistSummary[],
    };
};