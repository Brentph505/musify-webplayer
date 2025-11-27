<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';
    import Play from 'lucide-svelte/icons/play';

    export let data: PageData;

    // Destructure the categorized playlists from the data prop
    $: englishPlaylists = data.englishPlaylists;
    $: filipinoPlaylists = data.filipinoPlaylists;
    $: japanesePlaylists = data.japanesePlaylists;
    $: featuredPlaylists = data.featuredPlaylists; // NEW: Destructure featured playlists

    // Helper to get the URL of the highest quality image
    function getImageUrl(images: { quality: string; url: string }[] | undefined): string {
        if (!images || images.length === 0) {
            return 'https://via.placeholder.com/150?text=Playlist';
        }
        // Assuming the last image is the highest quality
        return images[images.length - 1].url;
    }

    // Function to navigate to the playlist detail page
    function handlePlaylistClick(playlistId: string) {
        goto(`/playlist/${playlistId}`);
    }

    // Get greeting based on time of day
    function getGreeting(): string {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }

    // Simulate playing a playlist (add your own logic)
    function handlePlayClick(event: Event, playlistId: string) {
        event.stopPropagation();
        console.log('Playing playlist:', playlistId);
        // Add your play logic here, e.g., call playerStore.startPlaying with the first song of the playlist
    }
</script>

<div class="home-container">
    <!-- Greeting Section (remains the same) -->
    <section class="greeting-section">
        <h1 class="greeting-title">{getGreeting()}</h1>
        {#if englishPlaylists.length > 0}
        <div class="quick-picks-grid">
            {#each englishPlaylists.slice(0, 6) as playlist (playlist.id)}
                <div
                    class="quick-pick-card"
                    on:click={() => handlePlaylistClick(playlist.id)}
                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                    role="button"
                    tabindex="0"
                    aria-label="Go to playlist {playlist.name}"
                >
                    <img 
                        src={getImageUrl(playlist.image)} 
                        alt={playlist.name} 
                        class="quick-pick-image"
                    />
                    <span class="quick-pick-title">{playlist.name}</span>
                    <button
                        class="play-button"
                        on:click={(e) => handlePlayClick(e, playlist.id)}
                        aria-label="Play {playlist.name}"
                    >
                        <Play size={24} fill="black" />
                    </button>
                </div>
            {/each}
        </div>
        {:else}
            <p class="text-gray-400 mt-4">No quick picks for English playlists available right now.</p>
        {/if}
    </section>

    <!-- NEW: Featured Playlists Section -->
    <section class="content-section">
        <div class="section-header">
            <h2 class="section-title">Featured Playlists</h2>
            <!-- You can add a 'Show all' link if you create a dedicated /featured-playlists route -->
            <!-- <a href="/featured-playlists" class="show-all-link">Show all</a> -->
        </div>
        {#if featuredPlaylists.length > 0}
        <div class="playlist-grid">
            {#each featuredPlaylists as playlist (playlist.id)}
                <div
                    class="playlist-card"
                    on:click={() => handlePlaylistClick(playlist.id)}
                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                    role="button"
                    tabindex="0"
                    aria-label="Go to playlist {playlist.name}"
                >
                    <div class="playlist-image-wrapper">
                        <img 
                            src={getImageUrl(playlist.image)} 
                            alt={playlist.name} 
                            class="playlist-image"
                        />
                        <button
                            class="playlist-play-button"
                            on:click={(e) => handlePlayClick(e, playlist.id)}
                            aria-label="Play {playlist.name}"
                        >
                            <Play size={20} fill="black" />
                        </button>
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-title">{playlist.name}</h3>
                        <p class="playlist-description">
                            {playlist.description || 'Check out these hand-picked selections'}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
        {:else}
            <p class="text-gray-400 mt-4">No featured playlists to show right now. Try adding some IDs in +page.ts!</p>
        {/if}
    </section>

    <!-- English Playlists Section -->
    <section class="content-section">
        <div class="section-header">
            <h2 class="section-title">English Playlists</h2>
            <a href="/english-playlists" class="show-all-link">Show all</a>
        </div>
        {#if englishPlaylists.length > 0}
        <div class="playlist-grid">
            {#each englishPlaylists as playlist (playlist.id)}
                <div
                    class="playlist-card"
                    on:click={() => handlePlaylistClick(playlist.id)}
                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                    role="button"
                    tabindex="0"
                    aria-label="Go to playlist {playlist.name}"
                >
                    <div class="playlist-image-wrapper">
                        <img 
                            src={getImageUrl(playlist.image)} 
                            alt={playlist.name} 
                            class="playlist-image"
                        />
                        <button
                            class="playlist-play-button"
                            on:click={(e) => handlePlayClick(e, playlist.id)}
                            aria-label="Play {playlist.name}"
                        >
                            <Play size={20} fill="black" />
                        </button>
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-title">{playlist.name}</h3>
                        <p class="playlist-description">
                            {playlist.description || 'Curated English songs'}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
        {:else}
            <p class="text-gray-400 mt-4">No English playlists to show right now.</p>
        {/if}
    </section>

    <!-- Filipino Playlists Section -->
    <section class="content-section">
        <div class="section-header">
            <h2 class="section-title">Filipino Vibes</h2>
            <a href="/filipino-playlists" class="show-all-link">Show all</a>
        </div>
        {#if filipinoPlaylists.length > 0}
        <div class="playlist-grid">
            {#each filipinoPlaylists as playlist (playlist.id)}
                <div
                    class="playlist-card"
                    on:click={() => handlePlaylistClick(playlist.id)}
                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                    role="button"
                    tabindex="0"
                    aria-label="Go to playlist {playlist.name}"
                >
                    <div class="playlist-image-wrapper">
                        <img 
                            src={getImageUrl(playlist.image)} 
                            alt={playlist.name} 
                            class="playlist-image"
                        />
                        <button
                            class="playlist-play-button"
                            on:click={(e) => handlePlayClick(e, playlist.id)}
                            aria-label="Play {playlist.name}"
                        >
                            <Play size={20} fill="black" />
                        </button>
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-title">{playlist.name}</h3>
                        <p class="playlist-description">
                            {playlist.description || 'Listen to OPM hits'}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
        {:else}
            <p class="text-gray-400 mt-4">No Filipino playlists to show right now. Try adding some IDs in +page.ts!</p>
        {/if}
    </section>

    <!-- Japanese Playlists Section -->
    <section class="content-section">
        <div class="section-header">
            <h2 class="section-title">Japanese Jams</h2>
            <a href="/japanese-playlists" class="show-all-link">Show all</a>
        </div>
        {#if japanesePlaylists.length > 0}
        <div class="playlist-grid">
            {#each japanesePlaylists as playlist (playlist.id)}
                <div
                    class="playlist-card"
                    on:click={() => handlePlaylistClick(playlist.id)}
                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                    role="button"
                    tabindex="0"
                    aria-label="Go to playlist {playlist.name}"
                >
                    <div class="playlist-image-wrapper">
                        <img 
                            src={getImageUrl(playlist.image)} 
                            alt={playlist.name} 
                            class="playlist-image"
                        />
                        <button
                            class="playlist-play-button"
                            on:click={(e) => handlePlayClick(e, playlist.id)}
                            aria-label="Play {playlist.name}"
                        >
                            <Play size={20} fill="black" />
                        </button>
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-title">{playlist.name}</h3>
                        <p class="playlist-description">
                            {playlist.description || 'Explore the world of J-Pop & more'}
                        </p>
                    </div>
                </div>
            {/each}
        </div>
        {:else}
            <p class="text-gray-400 mt-4">No Japanese playlists to show right now. Try adding some IDs in +page.ts!</p>
        {/if}
    </section>
</div>

<style>
    .home-container {
        padding: 0;
        margin: 0;
    }

    /* Greeting Section */
    .greeting-section {
        padding: 0 24px 24px 24px;
    }

    .greeting-title {
        font-size: 2rem;
        font-weight: 700;
        margin: 24px 0 16px 0;
        color: white;
    }

    .quick-picks-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        gap: 16px;
    }

    .quick-pick-card {
        position: relative;
        display: flex;
        align-items: center;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        transition: background-color 0.3s ease;
        height: 80px;
    }

    .quick-pick-card:hover {
        background-color: rgba(255, 255, 255, 0.2);
    }

    .quick-pick-card:hover .play-button {
        opacity: 1;
        transform: translateY(0);
    }

    .quick-pick-image {
        width: 80px;
        height: 80px;
        object-fit: cover;
        flex-shrink: 0;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .quick-pick-title {
        flex: 1;
        padding: 0 16px;
        font-weight: 700;
        font-size: 1rem;
        color: white;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .play-button {
        position: absolute;
        right: 8px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: #1db954;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.3s ease;
    }

    .play-button:hover {
        background-color: #1ed760;
        transform: scale(1.06) translateY(0);
    }

    /* Content Sections */
    .content-section {
        padding: 0 24px 32px 24px;
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .section-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: white;
        margin: 0;
    }

    .show-all-link {
        font-size: 0.875rem;
        font-weight: 700;
        color: #b3b3b3;
        text-decoration: none;
        transition: color 0.2s ease;
    }

    .show-all-link:hover {
        color: white;
        text-decoration: underline;
    }

    /* Playlist Grid */
    .playlist-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 24px;
    }

    .playlist-card {
        background-color: #181818;
        border-radius: 8px;
        padding: 16px;
        cursor: pointer;
        transition: background-color 0.3s ease;
        position: relative;
    }

    .playlist-card:hover {
        background-color: #282828;
    }

    .playlist-card:hover .playlist-play-button {
        opacity: 1;
        transform: translateY(0);
    }

    .playlist-image-wrapper {
        position: relative;
        margin-bottom: 16px;
    }

    .playlist-image {
        width: 100%;
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 4px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .playlist-play-button {
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background-color: #1db954;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        opacity: 0;
        transform: translateY(8px);
        transition: all 0.3s ease;
    }

    .playlist-play-button:hover {
        background-color: #1ed760;
        transform: scale(1.06) translateY(0);
    }

    .playlist-info {
        min-height: 62px;
    }

    .playlist-title {
        font-size: 1rem;
        font-weight: 700;
        color: white;
        margin: 0 0 4px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
    }

    .playlist-description {
        font-size: 0.875rem;
        color: #b3b3b3;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        line-height: 1.4;
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
        .quick-picks-grid {
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        }

        .playlist-grid {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 16px;
        }
    }

    @media (max-width: 768px) {
        .greeting-section,
        .content-section {
            padding: 0 16px 24px 16px;
        }

        .greeting-title {
            font-size: 1.5rem;
            margin: 16px 0 12px 0;
        }

        .quick-picks-grid {
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
        }

        .quick-pick-card {
            height: 64px;
        }

        .quick-pick-image {
            width: 64px;
            height: 64px;
        }

        .section-title {
            font-size: 1.25rem;
        }

        .playlist-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
            gap: 12px;
        }

        .playlist-card {
            padding: 12px;
        }
    }
</style>