<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import Play from 'lucide-svelte/icons/play';
    import Heart from 'lucide-svelte/icons/heart';
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
    import UserPlus from 'lucide-svelte/icons/user-plus';

    export let data: PageData;

    $: artist = data.artist;
    $: topSongs = data.topSongs;
    $: topAlbums = data.topAlbums;

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

    function playSong(songToPlay: any) {
        if (songToPlay && songToPlay.downloadUrl && songToPlay.downloadUrl.length > 0) {
            const audioUrl =
                songToPlay.downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')?.url ||
                songToPlay.downloadUrl[songToPlay.downloadUrl.length - 1].url;

            const songForPlayer: SongForPlayer = {
                id: songToPlay.id,
                name: songToPlay.name,
                artistName: songToPlay.artists?.primary?.[0]?.name || artist?.name || 'Unknown Artist',
                albumName: songToPlay.album?.name || 'Unknown Album',
                albumImageUrl: getImageUrl(songToPlay.image),
                audioUrl: audioUrl,
                duration: songToPlay.duration
            };
            playerStore.startPlaying(songForPlayer);
        }
    }

    function playArtistTopSong() {
        if (topSongs && topSongs.length > 0) {
            playSong(topSongs[0]);
        }
    }

    function handleSongClick(songId: string) {
        goto(`/song/${songId}`);
    }

    function handleAlbumClick(albumId: string) {
        goto(`/album/${albumId}`);
    }

    function formatNumber(num: number | null | undefined): string {
        if (!num) return '0';
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    }

</script>

<div class="artist-page">
    {#if artist}
        <!-- Hero Section with Artist Image -->
        <div class="hero-section">
            <div class="hero-background" style="background-image: url({getImageUrl(artist.image)})"></div>
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="artist-image-container">
                    <img
                        src={getImageUrl(artist.image)}
                        alt={artist.name}
                        class="artist-image"
                    />
                </div>
                <div class="artist-info">
                    <p class="verified-badge">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                        </svg>
                        Verified Artist
                    </p>
                    <h1 class="artist-name">{artist.name}</h1>
                    <div class="artist-stats">
                        {#if artist.followerCount}
                            <span class="stat-item">{formatNumber(artist.followerCount)} followers</span>
                        {/if}
                        {#if artist.dominantLanguage}
                            <span class="separator">•</span>
                            <span class="stat-item">{artist.dominantLanguage}</span>
                        {/if}
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="controls-section">
            <div class="controls-wrapper">
                <button class="play-button-main" on:click={playArtistTopSong} aria-label="Play artist's top songs">
                    <Play size={24} fill="currentColor" />
                </button>
                <button class="follow-button" aria-label="Follow artist">
                    <UserPlus size={16} />
                    <span>Follow</span>
                </button>
                <button class="icon-button" aria-label="More options">
                    <MoreHorizontal size={32} />
                </button>
            </div>
        </div>

        <!-- Top Songs Section -->
        {#if topSongs && topSongs.length > 0}
            <div class="content-section">
                <h2 class="section-title">Popular</h2>
                <div class="songs-list">
                    {#each topSongs.slice(0, 5) as song, index (song.id)}
                        <div
                            class="song-row"
                            on:click={() => handleSongClick(song.id)}
                            role="button"
                            tabindex="0"
                            aria-label="Play {song.name}"
                        >
                            <div class="song-number">
                                <span class="number-text">{index + 1}</span>
                                <span
                                    class="play-icon-hover"
                                    on:click|stopPropagation={() => playSong(song)}
                                >
                                    <Play size={16} fill="currentColor" />
                                </span>
                            </div>
                            <div class="song-info">
                                <img src={getImageUrl(song.image)} alt={song.name} class="song-thumbnail" />
                                <div class="song-details">
                                    <div class="song-name">{song.name}</div>
                                    <div class="song-plays">
                                        {(song as any).playCount ? formatNumber((song as any).playCount) : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="song-album">{song.album?.name || 'Single'}</div>
                            <div class="song-duration">
                                {#if song.duration}
                                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Discography Section -->
        {#if topAlbums && topAlbums.length > 0}
            <div class="content-section">
                <div class="section-header">
                    <h2 class="section-title">Discography</h2>
                    <button class="see-all-link">See all</button>
                </div>
                <div class="albums-grid">
                    {#each topAlbums.slice(0, 6) as album (album.id)}
                        <div
                            class="album-card"
                            on:click={() => handleAlbumClick(album.id)}
                            role="button"
                            tabindex="0"
                            aria-label="View album {album.name}"
                        >
                            <div class="album-image-wrapper">
                                <img
                                    src={getImageUrl(album.image)}
                                    alt={album.name}
                                    class="album-image"
                                />
                                <div class="album-play-overlay">
                                    <button class="album-play-button" aria-label="Play album">
                                        <Play size={20} fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                            <div class="album-info">
                                <div class="album-name">{album.name}</div>
                                <div class="album-meta">
                                    {album.year || ''} • {album.type || 'Album'}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Artist Bio Section -->
        {#if artist.bio && artist.bio.length > 0}
            <div class="content-section">
                <h2 class="section-title">About</h2>
                <div class="bio-section">
                    <div class="bio-image">
                        <img src={getImageUrl(artist.image)} alt={artist.name} />
                    </div>
                    <div class="bio-content">
                        <div class="bio-stats">
                            {#if artist.followerCount}
                                <div class="bio-stat">
                                    <div class="bio-stat-number">{formatNumber(artist.followerCount)}</div>
                                    <div class="bio-stat-label">Followers</div>
                                </div>
                            {/if}
                        </div>
                        <p class="bio-text">{artist.bio[0].text}</p>
                    </div>
                </div>
            </div>
        {/if}

    {:else}
        <div class="loading">
            <p>Loading artist details...</p>
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

    .artist-page {
        background-color: var(--background-base);
        min-height: 100vh;
        color: var(--text-base);
    }

    .hero-section {
        position: relative;
        height: 400px;
        overflow: hidden;
    }

    .hero-background {
        position: absolute;
        top: -50px;
        left: 0;
        right: 0;
        bottom: 0;
        background-size: cover;
        background-position: center;
        filter: blur(50px);
        opacity: 0.3;
        transform: scale(1.1);
    }

    .hero-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(180deg, rgba(18, 18, 18, 0.4) 0%, var(--background-base) 100%);
    }

    .hero-content {
        position: relative;
        max-width: 1400px;
        margin: 0 auto;
        padding: 80px 32px 24px;
        display: flex;
        gap: 24px;
        align-items: flex-end;
        height: 100%;
    }

    .artist-image-container {
        width: 232px;
        height: 232px;
        flex-shrink: 0;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 4px 60px rgba(0, 0, 0, 0.7);
    }

    .artist-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .artist-info {
        flex: 1;
        padding-bottom: 8px;
    }

    .verified-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        margin-bottom: 12px;
        color: var(--primary);
    }

    .artist-name {
        font-size: 96px;
        font-weight: 900;
        line-height: 1;
        margin: 0 0 16px 0;
        letter-spacing: -0.04em;
    }

    .artist-stats {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
    }

    .stat-item {
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
        gap: 16px;
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

    .follow-button {
        padding: 8px 24px;
        border-radius: 500px;
        border: 1px solid var(--text-subdued);
        background: transparent;
        color: var(--text-base);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 32px;
    }

    .follow-button:hover {
        transform: scale(1.04);
        border-color: var(--text-base);
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

    .content-section {
        padding: 0 32px 48px;
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
        background: none;
        border: none;
        cursor: pointer;
        transition: color 0.2s;
    }

    .see-all-link:hover {
        color: var(--text-base);
    }

    .songs-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .song-row {
        display: grid;
        grid-template-columns: 40px 1fr 2fr 60px;
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
        font-size: 16px;
    }

    .number-text {
        display: inline;
    }

    .play-icon-hover {
        display: none;
        color: var(--text-base);
        cursor: pointer;
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

    .song-plays {
        font-size: 14px;
        color: var(--text-subdued);
    }

    .song-album {
        color: var(--text-subdued);
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .song-duration {
        text-align: right;
        color: var(--text-subdued);
        font-size: 14px;
    }

    .albums-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 24px;
    }

    .album-card {
        background-color: var(--background-elevated-base);
        padding: 16px;
        border-radius: 8px;
        transition: background-color 0.3s;
        cursor: pointer;
    }

    .album-card:hover {
        background-color: var(--background-elevated-highlight);
    }

    .album-image-wrapper {
        position: relative;
        margin-bottom: 16px;
    }

    .album-image {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .album-play-overlay {
        position: absolute;
        bottom: 8px;
        right: 8px;
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.3s;
    }

    .album-card:hover .album-play-overlay {
        opacity: 1;
        transform: translateY(0);
    }

    .album-play-button {
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

    .album-play-button:hover {
        transform: scale(1.06);
        background-color: var(--primary-hover);
    }

    .album-info {
        min-width: 0;
    }

    .album-name {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .album-meta {
        font-size: 14px;
        color: var(--text-subdued);
    }

    .bio-section {
        display: grid;
        grid-template-columns: 300px 1fr;
        gap: 32px;
        background-color: var(--background-elevated-base);
        padding: 24px;
        border-radius: 8px;
    }

    .bio-image {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
    }

    .bio-image img {
        width: 100%;
        height: auto;
        display: block;
    }

    .bio-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .bio-stats {
        display: flex;
        gap: 32px;
    }

    .bio-stat-number {
        font-size: 48px;
        font-weight: 900;
        line-height: 1;
        margin-bottom: 8px;
    }

    .bio-stat-label {
        font-size: 14px;
        color: var(--text-subdued);
    }

    .bio-text {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-subdued);
    }

    .loading {
        padding: 100px 32px;
        text-align: center;
        color: var(--text-subdued);
    }

    @media (max-width: 1024px) {
        .bio-section {
            grid-template-columns: 1fr;
        }

        .song-row {
            grid-template-columns: 40px 1fr 60px;
        }

        .song-album {
            display: none;
        }
    }

    @media (max-width: 768px) {
        .hero-section {
            height: 340px;
        }

        .hero-content {
            padding: 40px 16px 16px;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .artist-image-container {
            width: 192px;
            height: 192px;
        }

        .artist-name {
            font-size: 48px;
        }

        .controls-section {
            padding: 16px;
        }

        .content-section {
            padding: 0 16px 32px;
        }

        .albums-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 16px;
        }
    }
</style>