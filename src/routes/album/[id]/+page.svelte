<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import Play from 'lucide-svelte/icons/play';
    import Clock from 'lucide-svelte/icons/clock';
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
    import Heart from 'lucide-svelte/icons/heart';

    export let data: PageData;

    interface Image {
        quality: string;
        url: string;
    }

    type DownloadUrlItem = {
        quality: string;
        url: string;
    };

    function getImageUrl(images: Image[] | undefined): string {
        if (!images || images.length === 0) return '/default-album-art.png';
        const highQuality = images.find(img => img.quality === '500x500' || img.quality === '150x150');
        return highQuality ? highQuality.url : images[0].url;
    }

    function playFirstAlbumSong() {
        if (data.album && data.album.songs && data.album.songs.length > 0) {
            const firstSong = data.album.songs[0];
            if ((firstSong as any).downloadUrl && (firstSong as any).downloadUrl.length > 0) {
                const audioUrl =
                    (firstSong as any).downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')?.url ||
                    (firstSong as any).downloadUrl[(firstSong as any).downloadUrl.length - 1].url;

                const artistName =
                    firstSong.artists?.primary?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

                const songForPlayer: SongForPlayer = {
                    id: firstSong.id,
                    name: firstSong.name,
                    artistName: artistName,
                    albumName: firstSong.album?.name || data.album.name || 'Unknown Album',
                    albumImageUrl: getImageUrl(firstSong.image),
                    audioUrl: audioUrl,
                    duration: firstSong.duration || 0
                };
                playerStore.startPlaying(songForPlayer);
            }
        }
    }

    function handleSongCardClick(songId: string) {
        goto(`/song/${songId}`);
    }

    function formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getTotalDuration(): string {
        if (!data.album?.songs) return '0 min';
        const total = data.album.songs.reduce((acc, song) => acc + (song.duration || 0), 0);
        const hours = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        if (hours > 0) return `${hours} hr ${mins} min`;
        return `${mins} min`;
    }

</script>

<div class="album-page">
    {#if data.album}
        <!-- Hero Section with Gradient Background -->
        <div class="hero-section">
            <div class="hero-content">
                <div class="album-cover-large">
                    <img
                        src={getImageUrl(data.album.image)}
                        alt={data.album.name}
                        class="cover-image"
                    />
                </div>
                <div class="album-info">
                    <p class="album-type">ALBUM</p>
                    <h1 class="album-title">{data.album.name}</h1>
                    {#if data.album.description}
                        <p class="album-description">{data.album.description}</p>
                    {/if}
                    <div class="album-meta">
                        <div class="artist-name">
                            {#if data.album.artists?.primary}
                                {#each data.album.artists.primary as artist, i (artist.id)}
                                    <a href="/artist/{artist.id}" class="artist-link">{artist.name}</a>
                                    {#if i < data.album.artists.primary.length - 1},&nbsp;{/if}
                                {/each}
                            {/if}
                        </div>
                        {#if data.album.year}
                            <span class="separator">•</span>
                            <span>{data.album.year}</span>
                        {/if}
                        {#if data.album.songs}
                            <span class="separator">•</span>
                            <span>{data.album.songs.length} songs</span>
                            <span class="separator">•</span>
                            <span>{getTotalDuration()}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="controls-section">
            <div class="controls-wrapper">
                <button class="play-button-main" on:click={playFirstAlbumSong} aria-label="Play album">
                    <Play size={24} fill="currentColor" />
                </button>
                <button class="icon-button" aria-label="Like album">
                    <Heart size={32} />
                </button>
                <button class="icon-button" aria-label="More options">
                    <MoreHorizontal size={32} />
                </button>
            </div>
        </div>

        <!-- Songs List -->
        <div class="songs-section">
            <div class="songs-header">
                <div class="header-number">#</div>
                <div class="header-title">Title</div>
                <div class="header-duration">
                    <Clock size={16} />
                </div>
            </div>
            
            {#if data.album.songs && data.album.songs.length > 0}
                <div class="songs-list">
                    {#each data.album.songs as song, index (song.id)}
                        <div
                            class="song-row"
                            on:click={() => handleSongCardClick(song.id)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') handleSongCardClick(song.id);
                            }}
                            role="button"
                            tabindex="0"
                            aria-label="Play {song.name}"
                        >
                            <div class="song-number">
                                <span class="number-text">{index + 1}</span>
                                <span class="play-icon-hover">
                                    <Play size={16} fill="currentColor" />
                                </span>
                            </div>
                            <div class="song-info">
                                <img src={getImageUrl(song.image)} alt={song.name} class="song-thumbnail" />
                                <div class="song-details">
                                    <div class="song-name">{song.name}</div>
                                    <div class="song-artist">
                                        {#if song.artists?.primary}
                                            {#each song.artists.primary as artist, i (artist.id)}
                                                <a
                                                    href="/artist/{artist.id}"
                                                    class="artist-link"
                                                    on:click|stopPropagation
                                                >
                                                    {artist.name}
                                                </a>
                                                {#if i < song.artists.primary.length - 1},&nbsp;{/if}
                                            {/each}
                                        {/if}
                                    </div>
                                </div>
                            </div>
                            <div class="song-duration">
                                {song.duration ? formatDuration(song.duration) : ''}
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="no-songs">No songs found for this album.</p>
            {/if}
        </div>

        <!-- Additional Info Section -->
        <div class="info-section">
            {#if data.album.year || data.album.language || data.album.playCount}
                <div class="info-grid">
                    {#if data.album.year}
                        <div class="info-item">
                            <div class="info-label">Release Date</div>
                            <div class="info-value">{data.album.year}</div>
                        </div>
                    {/if}
                    {#if data.album.language}
                        <div class="info-item">
                            <div class="info-label">Language</div>
                            <div class="info-value">{data.album.language}</div>
                        </div>
                    {/if}
                    {#if data.album.playCount}
                        <div class="info-item">
                            <div class="info-label">Play Count</div>
                            <div class="info-value">{data.album.playCount.toLocaleString()}</div>
                        </div>
                    {/if}
                </div>
            {/if}
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

    .album-page {
        background-color: var(--background-base);
        min-height: 100vh;
        color: var(--text-base);
    }

    .hero-section {
        background: linear-gradient(180deg, #1a1a1a 0%, var(--background-base) 100%);
        padding: 80px 32px 24px;
        position: relative;
    }

    .hero-content {
        max-width: 1400px;
        margin: 0 auto;
        display: flex;
        gap: 32px;
        align-items: flex-end;
    }

    .album-cover-large {
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

    .album-info {
        flex: 1;
        padding-bottom: 8px;
    }

    .album-type {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        color: var(--text-base);
    }

    .album-title {
        font-size: 72px;
        font-weight: 900;
        line-height: 1.1;
        margin: 0 0 16px 0;
        letter-spacing: -0.04em;
    }

    .album-description {
        font-size: 14px;
        color: var(--text-subdued);
        margin-bottom: 12px;
        line-height: 1.6;
    }

    .album-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        flex-wrap: wrap;
    }

    .artist-link {
        color: var(--text-subdued);
        text-decoration: none;
    }

    .artist-link:hover {
        text-decoration: underline;
        color: var(--text-base);
    }

    .artist-name {
        font-weight: 700;
        color: var(--text-base);
    }

    .separator {
        color: var(--text-subdued);
    }

    .controls-section {
        background: linear-gradient(rgba(0, 0, 0, 0.6) 0, var(--background-base) 100%);
        padding: 24px 32px;
    }

    .controls-wrapper {
        max-width: 1400px;
        margin: 0 auto;
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

    .songs-section {
        padding: 0 32px 32px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .songs-header {
        display: grid;
        grid-template-columns: 40px 1fr 60px;
        gap: 16px;
        padding: 8px 16px;
        border-bottom: 1px solid var(--background-elevated-highlight);
        color: var(--text-subdued);
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    }

    .header-number {
        text-align: center;
    }

    .header-title {
        text-align: left;
    }

    .header-duration {
        text-align: right;
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }

    .songs-list {
        display: flex;
        flex-direction: column;
    }

    .song-row {
        display: grid;
        grid-template-columns: 40px 1fr 60px;
        gap: 16px;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
        align-items: center;
    }

    .song-row:hover {
        background-color: var(--background-elevated-highlight);
    }

    .song-number {
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
    }

    .song-row:hover .number-text {
        display: none;
    }

    .song-row:hover .play-icon-hover {
        display: inline;
    }

    .song-info {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
    }

    .song-thumbnail {
        width: 40px;
        height: 40px;
        border-radius: 2px;
        object-fit: cover;
        flex-shrink: 0;
    }

    .song-details {
        min-width: 0;
        flex: 1;
    }

    .song-name {
        font-size: 16px;
        font-weight: 400;
        color: var(--text-base);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 4px;
    }

    .song-row:hover .song-name {
        color: var(--primary);
    }

    .song-artist {
        font-size: 14px;
        color: var(--text-subdued);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .song-artist .artist-link {
        font-size: 14px;
        color: var(--text-subdued);
    }

    .song-duration {
        text-align: right;
        color: var(--text-subdued);
        font-size: 14px;
    }

    .no-songs {
        padding: 32px;
        text-align: center;
        color: var(--text-subdued);
    }

    .info-section {
        padding: 32px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 24px;
    }

    .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .info-label {
        font-size: 12px;
        color: var(--text-subdued);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .info-value {
        font-size: 14px;
        color: var(--text-base);
    }

    @media (max-width: 768px) {
        .hero-section {
            padding: 40px 16px 16px;
        }

        .hero-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 24px;
        }

        .album-cover-large {
            width: 192px;
            height: 192px;
        }

        .album-title {
            font-size: 32px;
        }

        .controls-section {
            padding: 16px;
        }

        .songs-section {
            padding: 0 16px 16px;
        }

        .songs-header {
            grid-template-columns: 30px 1fr 50px;
            gap: 8px;
            padding: 8px;
        }

        .song-row {
            grid-template-columns: 30px 1fr 50px;
            gap: 8px;
            padding: 8px;
        }

        .song-thumbnail {
            width: 32px;
            height: 32px;
        }

        .info-section {
            padding: 16px;
        }
    }
</style>