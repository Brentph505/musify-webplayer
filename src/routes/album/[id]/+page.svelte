<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import Play from 'lucide-svelte/icons/play';
    import Pause from 'lucide-svelte/icons/pause'; // NEW: Import Pause icon
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

    // NEW: Reactive state for album songs and player interaction
    let albumSongsForPlayer: SongForPlayer[] = [];

    $: if (data.album && data.album.songs) {
        albumSongsForPlayer = data.album.songs
            .filter(song => (song as any).downloadUrl && (song as any).downloadUrl.length > 0)
            .map(song => {
                const audioUrl =
                    (song as any).downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')?.url ||
                    (song as any).downloadUrl[(song as any).downloadUrl.length - 1].url;

                const artistName =
                    song.artists?.primary?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

                return {
                    id: song.id,
                    name: song.name,
                    artistName: artistName,
                    albumName: song.album?.name || data.album.name || 'Unknown Album',
                    albumImageUrl: getImageUrl(song.image),
                    audioUrl: audioUrl,
                    duration: song.duration || 0
                };
            });
    }

    // NEW: Reactive declarations from player store
    $: currentPlayingSongId = $playerStore.currentSong?.id;
    $: isPlaying = $playerStore.isPlaying;
    $: albumSongIds = new Set(albumSongsForPlayer.map(s => s.id));
    $: playerRecommendationIds = new Set($playerStore.recommendations.map(s => s.id));

    // Checks if the current album's songs are precisely the recommendations in the player
    $: isThisAlbumLoadedInPlayer =
        albumSongIds.size > 0 &&
        albumSongIds.size === playerRecommendationIds.size &&
        [...albumSongIds].every(id => playerRecommendationIds.has(id));

    // True if this album is loaded in the player AND a song from it is currently playing
    $: isAlbumCurrentlyPlaying = isPlaying && isThisAlbumLoadedInPlayer && currentPlayingSongId;

    function togglePlayAlbum() {
        if (isAlbumCurrentlyPlaying) {
            playerStore.pausePlaying();
        } else if (albumSongsForPlayer.length > 0) {
            // If the album is loaded but paused, resume.
            // Otherwise, set recommendations and start the first song.
            if (isThisAlbumLoadedInPlayer && $playerStore.currentSong) {
                playerStore.resumePlaying();
            } else {
                playerStore.setRecommendations(albumSongsForPlayer);
                playerStore.startPlaying(albumSongsForPlayer[0]);
            }
        }
    }

    function playSpecificAlbumSong(song: SongForPlayer) {
        // Ensure this album's songs are the current recommendations
        if (!isThisAlbumLoadedInPlayer) {
            playerStore.setRecommendations(albumSongsForPlayer);
        }
        playerStore.startPlaying(song);
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

<div class="min-h-screen text-white bg-[#121212]">
    {#if data.album}
        <!-- Hero Section -->
        <div class="relative overflow-hidden">
            <!-- Blurred Background Image with Gradient Overlay -->
            <div 
                class="absolute inset-0" 
                style="background-image: url({getImageUrl(data.album.image)}); background-size: cover; background-position: center; filter: blur(50px); transform: scale(1.1);"
            >
                <div class="absolute inset-0 bg-gradient-to-b from-[#1a1a1a]/40 via-[#1a1a1a]/80 to-[#121212]"></div>
            </div>
            
            <!-- Content -->
            <div class="relative pt-12 pb-4 md:pt-16">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <!-- Mobile: Stacked Layout -->
                    <div class="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">
                        <!-- Album Cover -->
                        <div class="flex-shrink-0 w-44 h-44 md:w-[232px] md:h-[232px] shadow-2xl">
                            <img
                                src={getImageUrl(data.album.image)}
                                alt={data.album.name}
                                class="w-full h-full object-cover rounded-md"
                                loading="lazy" 
                            />
                        </div>
                        <div class="flex-1 min-w-0 pb-2 text-center md:text-left w-full">
                            <p class="text-xs md:text-sm font-bold mb-1 md:mb-2 uppercase tracking-wide text-white">Album</p>
                            <h1 class="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-black mb-2 md:mb-6 break-words leading-tight">{data.album.name}</h1>
                            {#if data.album.description}
                                <p class="text-sm text-neutral-400 mb-3 md:mb-4 line-clamp-2">{data.album.description}</p>
                            {/if}
                            <div class="flex items-center gap-1 text-[11px] md:text-sm font-medium flex-wrap justify-center md:justify-start text-neutral-400">
                                <div class="font-bold text-white">
                                    {#if data.album.artists?.primary}
                                        {#each data.album.artists.primary as artist, i (artist.id)}
                                            <a href="/artist/{artist.id}" class="hover:underline">{artist.name}</a>
                                            {#if i < data.album.artists.primary.length - 1},&nbsp;{/if}
                                        {/each}
                                    {/if}
                                </div>
                                {#if data.album.year}
                                    <span class="mx-1">•</span>
                                    <span>{data.album.year}</span>
                                {/if}
                                {#if data.album.songs}
                                    <span class="mx-1">•</span>
                                    <span>{data.album.songs.length} songs</span>
                                    <span class="mx-1">•</span>
                                    <span>{getTotalDuration()}</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md border-b border-white/5">
            <div class="py-3 md:py-4 px-2 md:px-6">
                <div class="max-w-[1955px] mx-auto flex items-center gap-3 md:gap-8">
                    <button 
                        class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-green-500 flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-transform active:scale-100 shadow-xl text-black" 
                        on:click={togglePlayAlbum} aria-label="Play album"
                    >
                        {#if isAlbumCurrentlyPlaying}
                            <Pause size={20} fill="currentColor" class="md:w-6 md:h-6 ml-0.5" />
                        {:else}
                            <Play size={20} fill="currentColor" class="md:w-6 md:h-6 ml-0.5" />
                        {/if}
                    </button>
                    <button class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95" aria-label="Like album">
                        <Heart size={26} class="md:w-8 md:h-8" />
                    </button>
                    <button class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95" aria-label="More options">
                        <MoreHorizontal size={26} class="md:w-8 md:h-8" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Songs List -->
        <div class="py-4 md:py-6">
            <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                <div class="grid grid-cols-[30px_4fr_50px] md:grid-cols-[40px_1fr_60px] gap-4 px-4 py-2 text-sm text-neutral-400 border-b border-white/10">
                    <div class="text-center">#</div>
                    <div class="text-left">Title</div>
                    <div class="flex justify-end pr-6">
                        <Clock size={16} />
                    </div>
                </div>
                
                {#if data.album.songs && data.album.songs.length > 0}
                    <div class="flex flex-col">
                        {#each data.album.songs as song, index (song.id)}
                            <div
                                class="grid grid-cols-[30px_4fr_50px] md:grid-cols-[40px_1fr_60px] gap-4 px-4 py-2 rounded hover:bg-[#282828] group cursor-pointer items-center"
                                class:text-green-500={currentPlayingSongId === song.id}
                                on:click={() => {
                                    if (currentPlayingSongId === song.id) {
                                        if (isPlaying) {
                                            playerStore.pausePlaying();
                                        } else {
                                            playerStore.resumePlaying();
                                        }
                                    } else {
                                        playSpecificAlbumSong(albumSongsForPlayer[index]);
                                    }
                                }}
                                on:keydown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        if (currentPlayingSongId === song.id) {
                                            if (isPlaying) {
                                                playerStore.pausePlaying();
                                            } else {
                                                playerStore.resumePlaying();
                                            }
                                        } else {
                                            playSpecificAlbumSong(albumSongsForPlayer[index]);
                                        }
                                    }
                                }}
                                role="button"
                                tabindex="0"
                                aria-label="{currentPlayingSongId === song.id && isPlaying ? 'Pause' : 'Play'} {song.name}"
                            >
                                <div class="text-center relative text-neutral-400 text-sm flex items-center justify-center h-full">
                                    {#if currentPlayingSongId === song.id && isPlaying}
                                        <Pause size={16} fill="currentColor" class="block text-green-500" />
                                    {:else if currentPlayingSongId === song.id && !isPlaying}
                                        <Play size={16} fill="currentColor" class="block text-green-500" />
                                    {:else}
                                        <span class="block group-hover:hidden">{index + 1}</span>
                                        <span class="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:block">
                                            <Play size={16} fill="currentColor" />
                                        </span>
                                    {/if}
                                </div>
                                <div class="flex items-center gap-3 min-w-0">
                                    <img src={getImageUrl(song.image)} alt={song.name} class="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
                                    <div class="min-w-0 flex-1">
                                        <div class="font-medium truncate text-sm md:text-base mb-1" class:text-green-500={currentPlayingSongId === song.id}>{song.name}</div>
                                        <div class="text-xs md:text-sm text-neutral-400 truncate">
                                            {#if song.artists?.primary}
                                                {#each song.artists.primary as artist, i (artist.id)}
                                                    <a href="/artist/{artist.id}" class="hover:underline text-neutral-400" on:click={(e) => {
                                                        e.preventDefault(); // Prevent default browser navigation
                                                        e.stopPropagation(); // Stop event from bubbling up to the song row div
                                                        goto(`/artist/${artist.id}`); // Manually navigate using SvelteKit's goto
                                                    }}>
                                                        {artist.name}
                                                    </a>
                                                    {#if i < song.artists.primary.length - 1},&nbsp;{/if}
                                                {/each}
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                                <div class="text-right text-neutral-400 text-sm pr-6">
                                    {song.duration ? formatDuration(song.duration) : ''}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="py-8 text-center text-neutral-400">No songs found for this album.</p>
                {/if}
            </div>
        </div>

        <!-- Additional Info Section -->
        <div class="py-4 md:py-6">
            <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                {#if data.album.year || data.album.language || data.album.playCount}
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                        {#if data.album.year}
                            <div class="flex flex-col gap-1">
                                <div class="text-xs text-neutral-400 uppercase tracking-wide">Release Date</div>
                                <div class="text-sm font-medium text-white">{data.album.year}</div>
                            </div>
                        {/if}
                        {#if data.album.language}
                            <div class="flex flex-col gap-1">
                                <div class="text-xs text-neutral-400 uppercase tracking-wide">Language</div>
                                <div class="text-sm font-medium text-white">{data.album.language}</div>
                            </div>
                        {/if}
                        {#if data.album.playCount}
                            <div class="flex flex-col gap-1">
                                <div class="text-xs text-neutral-400 uppercase tracking-wide">Play Count</div>
                                <div class="text-sm font-medium text-white">{data.album.playCount.toLocaleString()}</div>
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    /* 
    This style block is intentionally left empty.
    All previous styling has been migrated to Tailwind CSS classes.
    */
</style>