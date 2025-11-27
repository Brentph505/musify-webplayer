<script lang="ts">
    import type { PageData } from './$types.js';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import { goto } from '$app/navigation';
    import Play from 'lucide-svelte/icons/play';
    import Heart from 'lucide-svelte/icons/heart';
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
    import Plus from 'lucide-svelte/icons/plus';
    import Share2 from 'lucide-svelte/icons/share-2';

    export let data: PageData;

    $: song = data.song;
    $: suggestions = data.suggestions;
    $: otherAlbumTracks = data.otherAlbumTracks;

    type DownloadUrlItem = {
        quality: string;
        url: string;
    };

    function getImageUrl(images: { quality: string; url: string }[] | undefined): string {
        if (!images || images.length === 0) {
            return 'https://via.placeholder.com/300?text=No+Image';
        }
        return images[images.length - 1].url;
    }

    function formatDuration(durationInSeconds: number | null): string {
        if (durationInSeconds === null || isNaN(durationInSeconds)) {
            return '--:--';
        }
        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = Math.floor(durationInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function playSong(songToPlay: any) {
        if (songToPlay && songToPlay.downloadUrl && songToPlay.downloadUrl.length > 0) {
            const audioUrl =
                songToPlay.downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')?.url ||
                songToPlay.downloadUrl[songToPlay.downloadUrl.length - 1].url;

            const songForPlayer: SongForPlayer = {
                id: songToPlay.id,
                name: songToPlay.name,
                artistName: songToPlay.artists?.primary?.[0]?.name || 'Unknown Artist',
                albumName: songToPlay.album?.name || 'Unknown Album',
                albumImageUrl: getImageUrl(songToPlay.image),
                audioUrl: audioUrl,
                duration: songToPlay.duration
            };
            playerStore.startPlaying(songForPlayer);
        }
    }

    function handleTrackClick(trackId: string) {
        goto(`/song/${trackId}`);
    }

    function formatNumber(num: number | null | undefined): string {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    }

    $: if (suggestions && suggestions.length > 0) {
        const mappedSuggestions: SongForPlayer[] = suggestions.map((s: any) => ({
            id: s.id,
            name: s.name,
            artistName: s.artists?.primary?.[0]?.name || 'Unknown Artist',
            albumName: s.album?.name || 'Unknown Album',
            albumImageUrl: getImageUrl(s.image),
            audioUrl: s.downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')?.url || s.downloadUrl[s.downloadUrl.length - 1].url,
            duration: s.duration
        }));
        playerStore.setRecommendations(mappedSuggestions);
    }
</script>

<div class="song-page">
    {#if song}
        <!-- Hero Section -->
        <div class="hero-section">
            <div class="hero-background" style="background-image: url({getImageUrl(song.image)})"></div>
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="song-cover-large">
                    <img
                        src={getImageUrl(song.image)}
                        alt={song.name}
                        class="cover-image"
                    />
                </div>
                <div class="song-info">
                    <p class="song-type">{song.type?.toUpperCase() || 'SONG'}</p>
                    <h1 class="song-title">{song.name}</h1>
                    <div class="song-meta">
                        {#if song.artists?.primary?.length}
                            <div class="artists-list">
                                {#each song.artists.primary as artist, i}
                                    <a href="/artist/{artist.id}" class="artist-link">{artist.name}</a>{#if i < song.artists.primary.length - 1}, {/if}
                                {/each}
                            </div>
                        {/if}
                        {#if song.album?.name}
                            <span class="separator">•</span>
                            <a href="/album/{song.album.id}" class="album-link">{song.album.name}</a>
                        {/if}
                        {#if song.year}
                            <span class="separator">•</span>
                            <span>{song.year}</span>
                        {/if}
                        {#if song.duration !== null}
                            <span class="separator">•</span>
                            <span>{formatDuration(song.duration)}</span>
                        {/if}
                        {#if song.playCount}
                            <span class="separator">•</span>
                            <span>{formatNumber(song.playCount)} plays</span>
                        {/if}
                        {#if song.language}
                            <span class="separator">•</span>
                            <span class="language-tag">{song.language}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="controls-section">
            <div class="controls-wrapper">
                <button class="play-button-main" on:click={() => playSong(song)} aria-label="Play {song.name}">
                    <Play size={24} fill="currentColor" />
                </button>
                <button class="icon-button heart-button" aria-label="Like song">
                    <Heart size={32} />
                </button>
                <button class="icon-button" aria-label="Add to playlist">
                    <Plus size={32} />
                </button>
                <button class="icon-button" aria-label="Share">
                    <Share2 size={28} />
                </button>
                <button class="icon-button" aria-label="More options">
                    <MoreHorizontal size={32} />
                </button>
            </div>
        </div>

        <!-- Other Tracks from Album -->
        {#if otherAlbumTracks && otherAlbumTracks.length > 0}
            <div class="content-section">
                <div class="section-header">
                    <h2 class="section-title">More from {song.album?.name || 'this Album'}</h2>
                    <a href="/album/{song.album?.id}" class="see-all-link">See all</a>
                </div>
                <div class="tracks-list">
                    {#each otherAlbumTracks.slice(0, 5) as track, index (track.id)}
                        <div
                            class="track-row"
                            on:click={() => handleTrackClick(track.id)}
                            role="button"
                            tabindex="0"
                            aria-label="Play {track.name}"
                        >
                            <div class="track-number">
                                <span class="number-text">{index + 1}</span>
                                <span
                                    class="play-icon-hover"
                                    on:click|stopPropagation={() => playSong(track)}
                                >
                                    <Play size={16} fill="currentColor" />
                                </span>
                            </div>
                            <div class="track-info">
                                <img src={getImageUrl(track.image)} alt={track.name} class="track-thumbnail" />
                                <div class="track-details">
                                    <div class="track-name">{track.name}</div>
                                    <div class="track-artist">{track.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
                                </div>
                            </div>
                            <div class="track-duration">
                                {formatDuration(track.duration)}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Lyrics Section -->
        {#if song.hasLyrics && song.lyricsId}
            <div class="content-section">
                <h2 class="section-title">Lyrics</h2>
                <div class="lyrics-placeholder">
                    <p>Lyrics functionality coming soon...</p>
                </div>
            </div>
        {/if}

        <!-- Suggestions Section -->
        {#if suggestions && suggestions.length > 0}
            <div class="content-section">
                <h2 class="section-title">Recommended</h2>
                <div class="suggestions-grid">
                    {#each suggestions.slice(0, 6) as suggestedSong (suggestedSong.id)}
                        <div
                            class="suggestion-card"
                            on:click={() => handleTrackClick(suggestedSong.id)}
                            role="button"
                            tabindex="0"
                            aria-label="View {suggestedSong.name}"
                        >
                            <div class="suggestion-image-wrapper">
                                <img
                                    src={getImageUrl(suggestedSong.image)}
                                    alt={suggestedSong.name}
                                    class="suggestion-image"
                                />
                                <div class="suggestion-play-overlay">
                                    <button 
                                        class="suggestion-play-button" 
                                        on:click|stopPropagation={() => playSong(suggestedSong)}
                                        aria-label="Play {suggestedSong.name}"
                                    >
                                        <Play size={20} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                            <div class="suggestion-info">
                                <div class="suggestion-name">{suggestedSong.name}</div>
                                <div class="suggestion-artist">{suggestedSong.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

    {:else}
        <div class="loading">
            <p>Loading song details...</p>
        </div>
    {/if}
</div>

<style>
    :root {
        --background-base: #121212;
        --background-elevated-base: #1a1a1a;
        --background-elevated-highlight: #282828;
        --text-base: #ffffff;
        --text-subdued: #a7a7a7;
        --primary: #1ed760;
        --primary-hover: #169c46;
        --accent: #1db954;
    }

    .song-page {
        background-color: var(--background-base);
        min-height: 100vh;
        color: var(--text-base);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    .hero-section {
        position: relative;
        padding: 80px 32px 24px;
        overflow: hidden;
        display: flex;
        justify-content: center;
    }

    .hero-background {
        position: absolute;
        top: -50px;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(180deg, rgba(18, 18, 18, 0.6) 0%, var(--background-base) 100%);
    }

    .hero-content {
        position: relative;
        width: 100%;
        max-width: 1400px;
        display: flex;
        gap: 32px;
        align-items: flex-end;
    }

    .song-cover-large {
        width: 232px;
        height: 232px;
        flex-shrink: 0;
        box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5);
        border-radius: 4px;
        overflow: hidden;
    }

    .cover-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .song-info {
        flex: 1;
        padding-bottom: 8px;
    }

    .song-type {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        color: var(--text-base);
    }

    .song-title {
        font-size: 64px;
        font-weight: 900;
        line-height: 1.1;
        margin: 0 0 16px 0;
        letter-spacing: -0.04em;
    }

    .song-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        flex-wrap: wrap;
    }

    .artists-list {
        display: inline;
    }

    .artist-link {
        color: var(--text-base);
        text-decoration: none;
        font-weight: 700;
        transition: color 0.2s;
    }

    .artist-link:hover {
        color: var(--primary);
        text-decoration: underline;
    }

    .album-link {
        color: var(--text-base);
        text-decoration: none;
        transition: color 0.2s;
    }

    .album-link:hover {
        color: var(--primary);
        text-decoration: underline;
    }

    .separator {
        color: var(--text-subdued);
    }

    .controls-section {
        padding: 24px 32px;
        display: flex;
        justify-content: center;
    }

    .controls-wrapper {
        width: 100%;
        max-width: 1400px;
        display: flex;
        align-items: center;
        gap: 24px;
    }

    .play-button-main {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background-color: var(--primary);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        color: #000;
    }

    .play-button-main:hover {
        transform: scale(1.06);
        background-color: var(--primary-hover);
    }

    .icon-button {
        background: none;
        border: none;
        color: var(--text-subdued);
        cursor: pointer;
        padding: 8px;
        transition: color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-button:hover {
        color: var(--text-base);
    }

    .heart-button:hover {
        color: var(--primary);
    }

    .language-tag {
        text-transform: capitalize;
    }

    .content-section {
        padding: 16px 32px 48px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-title {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 16px;
    }

    .see-all-link {
        font-size: 14px;
        color: var(--text-subdued);
        font-weight: 700;
        text-decoration: none;
        transition: color 0.2s;
    }

    .see-all-link:hover {
        color: var(--text-base);
    }

    .tracks-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .track-row {
        display: grid;
        grid-template-columns: 40px 1fr 60px;
        gap: 16px;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
        align-items: center;
    }

    .track-row:hover {
        background-color: var(--background-elevated-highlight);
    }

    .track-number {
        text-align: center;
        position: relative;
        color: var(--text-subdued);
        font-size: 14px;
    }

    .number-text {
        display: inline;
    }

    .play-icon-hover {
        display: none;
        color: var(--text-base);
        cursor: pointer;
    }

    .track-row:hover .number-text {
        display: none;
    }

    .track-row:hover .play-icon-hover {
        display: inline;
    }

    .track-info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
    }

    .track-thumbnail {
        width: 40px;
        height: 40px;
        border-radius: 2px;
        object-fit: cover;
        flex-shrink: 0;
    }

    .track-details {
        min-width: 0;
        flex: 1;
    }

    .track-name {
        font-size: 16px;
        font-weight: 400;
        color: var(--text-base);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
    }

    .track-row:hover .track-name {
        color: var(--primary);
    }

    .track-artist {
        font-size: 14px;
        color: var(--text-subdued);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .track-duration {
        text-align: right;
        color: var(--text-subdued);
        font-size: 14px;
    }

    .lyrics-placeholder {
        background-color: var(--background-elevated-base);
        padding: 48px;
        border-radius: 8px;
        text-align: center;
        color: var(--text-subdued);
    }

    .suggestions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 24px;
    }

    .suggestion-card {
        background-color: var(--background-elevated-base);
        padding: 16px;
        border-radius: 8px;
        transition: background-color 0.3s;
        cursor: pointer;
    }

    .suggestion-card:hover {
        background-color: var(--background-elevated-highlight);
    }

    .suggestion-image-wrapper {
        position: relative;
        margin-bottom: 16px;
    }

    .suggestion-image {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .suggestion-play-overlay {
        position: absolute;
        bottom: 8px;
        right: 8px;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.3s;
    }

    .suggestion-card:hover .suggestion-play-overlay {
        opacity: 1;
        transform: translateY(0);
    }

    .suggestion-play-button {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: var(--primary);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #000;
        box-shadow: 0 8px 8px rgba(0, 0, 0, 0.3);
        transition: all 0.2s;
    }

    .suggestion-play-button:hover {
        transform: scale(1.06);
        background-color: var(--primary-hover);
    }

    .suggestion-info {
        min-width: 0;
    }

    .suggestion-name {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .suggestion-artist {
        font-size: 14px;
        color: var(--text-subdued);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .loading {
        padding: 100px 32px;
        text-align: center;
        color: var(--text-subdued);
    }

    @media (max-width: 768px) {
        .hero-background {
            display: none;
        }

        .hero-section {
            padding: 64px 16px 24px;
        }

        .hero-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 24px;
        }

        .song-cover-large {
            width: 280px;
            height: 280px;
        }

        .song-title {
            font-size: 40px;
        }
        
        .song-meta {
            justify-content: center;
        }

        .controls-section {
            padding: 24px 16px;
        }

        .controls-wrapper {
            gap: 16px;
        }

        .content-section {
            padding: 16px 16px 32px;
        }

        .details-grid {
            grid-template-columns: 1fr;
            gap: 16px;
        }

        .track-row {
            grid-template-columns: 30px 1fr 50px;
            gap: 12px;
            padding: 8px;
        }

        .track-thumbnail {
            width: 32px;
            height: 32px;
        }

        .suggestions-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 16px;
        }
        
        .suggestion-play-button {
            width: 40px;
            height: 40px;
        }
    }
</style>