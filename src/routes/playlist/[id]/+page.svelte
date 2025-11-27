<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import Play from 'lucide-svelte/icons/play';
    import Pause from 'lucide-svelte/icons/pause';
    import Clock from 'lucide-svelte/icons/clock';
    import Heart from 'lucide-svelte/icons/heart';
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';

    export let data: PageData;

    $: playlist = data.playlist;

    // Define a type for the downloadUrl items for better type safety
    type DownloadUrlItem = {
        quality: string;
        url: string;
    };

    // Helper to get the URL of the highest quality image
    function getImageUrl(images: { quality: string; url: string }[] | undefined): string {
        if (!images || images.length === 0) {
            return 'https://via.placeholder.com/300?text=No+Image';
        }
        return images[images.length - 1].url; // Assuming last is highest quality
    }

    // Helper to get artist names from a song object
    function getArtistNames(artists: { primary: any[] } | undefined): string {
        if (!artists || !artists.primary || artists.primary.length === 0) return '';
        return artists.primary.map((a) => a.name).join(', ');
    }

    // Helper to format duration from seconds to MM:SS
    function formatDuration(seconds: number | null): string {
        if (seconds === null || isNaN(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function getTotalDuration(): string {
        if (!playlist?.songs) return '0 min';
        const total = playlist.songs.reduce((acc, song) => acc + (song.duration || 0), 0);
        const hours = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        if (hours > 0) return `${hours} hr ${mins} min`;
        return `${mins} min`;
    }

    // --- Player Integration Logic ---
    let playlistSongsForPlayer: SongForPlayer[] = [];

    $: if (playlist && playlist.songs) {
        playlistSongsForPlayer = playlist.songs
            .filter((song) => (song as any).downloadUrl && (song as any).downloadUrl.length > 0)
            .map((song) => {
                const audioUrl =
                    (song as any).downloadUrl.find((item: DownloadUrlItem) => item.quality === '320kbps')
                        ?.url || (song as any).downloadUrl[(song as any).downloadUrl.length - 1].url;

                return {
                    id: song.id,
                    name: song.name,
                    artistName: getArtistNames(song.artists),
                    albumName: song.album?.name || playlist?.name || 'Unknown Album',
                    albumImageUrl: getImageUrl(song.image),
                    audioUrl: audioUrl,
                    duration: song.duration || 0
                };
            });
    }

    $: currentPlayingSongId = $playerStore.currentSong?.id;
    $: isPlaying = $playerStore.isPlaying;
    $: playlistSongIds = new Set(playlistSongsForPlayer.map((s) => s.id));
    $: playerRecommendationIds = new Set($playerStore.recommendations.map((s) => s.id));

    $: isThisPlaylistLoadedInPlayer =
        playlistSongIds.size > 0 &&
        playlistSongIds.size === playerRecommendationIds.size &&
        [...playlistSongIds].every((id) => playerRecommendationIds.has(id));

    $: isPlaylistCurrentlyPlaying =
        isPlaying && isThisPlaylistLoadedInPlayer && currentPlayingSongId;

    function togglePlayPlaylist() {
        if (isPlaylistCurrentlyPlaying) {
            playerStore.pausePlaying();
        } else if (playlistSongsForPlayer.length > 0) {
            if (isThisPlaylistLoadedInPlayer && $playerStore.currentSong) {
                playerStore.resumePlaying();
            } else {
                playerStore.setRecommendations(playlistSongsForPlayer);
                playerStore.startPlaying(playlistSongsForPlayer[0]);
            }
        }
    }

    function playSpecificSong(song: SongForPlayer) {
        if (!isThisPlaylistLoadedInPlayer) {
            playerStore.setRecommendations(playlistSongsForPlayer);
        }
        playerStore.startPlaying(song);
    }
</script>

<div class="min-h-screen text-white bg-[#121212]">
    {#if playlist}
        <!-- Hero Section -->
        <div class="relative overflow-hidden">
            <div
                class="absolute inset-0 bg-cover bg-center blur-[50px] opacity-30 scale-110"
                style="background-image: url({getImageUrl(playlist.image)})"
            ></div>
            <div
                class="absolute inset-0 bg-gradient-to-b from-green-900/40 via-zinc-900/80 to-zinc-900"
            ></div>

            <div class="relative pt-12 pb-4 md:pt-16">
                <div class="max-w-[1955px] mx-auto px-4 md:px-6">
                    <div class="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">
                        <div class="flex-shrink-0 w-44 h-44 md:w-[232px] md:h-[232px] shadow-2xl">
                            <img
                                src={getImageUrl(playlist.image)}
                                alt={playlist.name}
                                class="w-full h-full object-cover rounded-md"
                            />
                        </div>
                        <div class="flex-1 min-w-0 pb-2 text-center md:text-left w-full">
                            <p class="text-xs md:text-sm font-bold mb-1 md:mb-2 uppercase tracking-wide">
                                {playlist.type || 'Playlist'}
                            </p>
                            <h1
                                class="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-black mb-2 md:mb-4 break-words leading-tight"
                            >
                                {playlist.name}
                            </h1>
                            {#if playlist.description}
                                <p class="text-sm text-neutral-400 mb-3 md:mb-4 line-clamp-2">
                                    {playlist.description}
                                </p>
                            {/if}
                            <div
                                class="flex items-center gap-2 text-[11px] md:text-sm font-medium flex-wrap justify-center md:justify-start"
                            >
                                {#if playlist.songCount}
                                    <span>{playlist.songCount} songs,</span>
                                {/if}
                                <span class="text-neutral-400">{getTotalDuration()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-white/5">
            <div class="py-3 md:py-4 px-4 md:px-6">
                <div class="max-w-[1955px] mx-auto flex items-center gap-3 md:gap-8">
                    <button
                        class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-green-500 flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-transform active:scale-100 shadow-xl text-black"
                        on:click={togglePlayPlaylist}
                        aria-label="Play playlist"
                    >
                        {#if isPlaylistCurrentlyPlaying}
                            <Pause size={20} fill="currentColor" class="md:w-6 md:h-6" />
                        {:else}
                            <Play size={20} fill="currentColor" class="md:w-6 md:h-6 ml-0.5" />
                        {/if}
                    </button>
                    <button
                        class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95"
                        aria-label="Save to library"
                    >
                        <Heart size={26} class="md:w-8 md:h-8" />
                    </button>
                    <button
                        class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95"
                        aria-label="More options"
                    >
                        <MoreHorizontal size={26} class="md:w-8 md:h-8" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Songs List -->
        <div class="py-4 md:py-6">
            <div class="max-w-[1955px] mx-auto px-4 md:px-6">
                <!-- Header Row for Desktop -->
                <div
                    class="hidden md:grid grid-cols-[40px_1fr_1fr_60px] gap-4 px-4 py-2 text-sm text-neutral-400 border-b border-white/10 mb-2"
                >
                    <div class="text-center">#</div>
                    <div class="text-left">Title</div>
                    <div class="text-left">Album</div>
                    <div class="flex justify-end pr-6">
                        <Clock size={16} />
                    </div>
                </div>

                {#if playlist.songs && playlist.songs.length > 0}
                    <div class="flex flex-col">
                        {#each playlist.songs as song, index (song.id)}
                            {@const songForPlayer = playlistSongsForPlayer[index]}
                            <div
                                class="grid grid-cols-[auto_1fr_auto] md:grid-cols-[40px_1fr_1fr_60px] gap-4 px-2 py-2 md:px-4 rounded hover:bg-zinc-800/60 group cursor-pointer items-center"
                                class:text-green-500={currentPlayingSongId === song.id}
                                on:click={() => {
                                    if (currentPlayingSongId === song.id) {
                                        if (isPlaying) playerStore.pausePlaying();
                                        else playerStore.resumePlaying();
                                    } else if (songForPlayer) {
                                        playSpecificSong(songForPlayer);
                                    }
                                }}
                                role="button"
                                tabindex="0"
                                aria-label="Play {song.name}"
                            >
                                <!-- Song Number/Play Button -->
                                <div
                                    class="text-center relative text-neutral-400 text-sm flex items-center justify-center h-full w-10"
                                >
                                    {#if currentPlayingSongId === song.id && isPlaying}
                                        <Pause size={16} fill="currentColor" class="block text-green-500" />
                                    {:else if currentPlayingSongId === song.id && !isPlaying}
                                        <Play size={16} fill="currentColor" class="block text-green-500" />
                                    {:else}
                                        <span class="block group-hover:hidden">{index + 1}</span>
                                        <button
                                            class="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:block text-white"
                                            aria-label="Play {song.name}"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                    {/if}
                                </div>

                                <!-- Title and Artist -->
                                <div class="flex items-center gap-3 min-w-0">
                                    <img
                                        src={getImageUrl(song.image)}
                                        alt={song.name}
                                        class="w-10 h-10 rounded object-cover flex-shrink-0"
                                    />
                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="font-medium truncate text-sm md:text-base text-white"
                                            class:!text-green-500={currentPlayingSongId === song.id}
                                        >
                                            {song.name}
                                        </div>
                                        <div class="text-xs md:text-sm text-neutral-400 truncate">
                                            {getArtistNames(song.artists)}
                                        </div>
                                    </div>
                                </div>

                                <!-- Album (Desktop Only) -->
                                <div class="hidden md:block text-sm text-neutral-400 truncate">
                                    {song.album?.name}
                                </div>

                                <!-- Duration / More Options -->
                                <div
                                    class="flex items-center justify-end gap-4 text-right text-neutral-400 text-sm pr-2 md:pr-6"
                                >
                                    <span class="hidden md:inline">{formatDuration(song.duration)}</span>
                                    <button
                                        class="md:hidden text-neutral-400 hover:text-white"
                                        on:click|stopPropagation={() => console.log('More options for', song.name)}
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="py-8 text-center text-neutral-400">This playlist is empty.</p>
                {/if}
            </div>
        </div>
    {:else}
        <div class="py-24 px-8 text-center text-[#a7a7a7]">
            <p>Loading playlist details...</p>
        </div>
    {/if}
</div>
<style>
    /* All custom styles have been migrated to Tailwind CSS classes in the markup */
</style>