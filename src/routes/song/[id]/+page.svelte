<script lang="ts">
    import type { PageData } from './$types.js';
    import { playerStore, type SongForPlayer } from '$lib/stores/playerStore.js';
    import { goto } from '$app/navigation';
    import Play from 'lucide-svelte/icons/play';
    import Heart from 'lucide-svelte/icons/heart';
    import MoreHorizontal from 'lucide-svelte/icons/more-horizontal';
    import Plus from 'lucide-svelte/icons/plus';
    import Share2 from 'lucide-svelte/icons/share-2';
    import Clock from 'lucide-svelte/icons/clock';

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

    // NEW: Helper function to truncate text
    function truncateText(text: string | undefined, maxLength: number): string {
        if (!text) return '';
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
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

<div class="min-h-screen text-white">
    {#if song}
        <!-- Hero Section with Gradient Background -->
        <div class="relative overflow-hidden">
            <!-- Gradient Background -->
            <div class="absolute inset-0 bg-gradient-to-b from-green-900/40 via-zinc-900/80 to-zinc-900" style="background-image: linear-gradient(transparent 0, rgba(0,0,0,.5) 100%), url({getImageUrl(song.image)}); background-size: cover; background-position: center; filter: blur(50px); transform: scale(1.1);"></div>
            
            <!-- Content -->
            <div class="relative pt-12 pb-4 md:pt-16">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <!-- Mobile: Stacked Layout -->
                    <div class="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">
                        <!-- Album Art -->
                        <div class="flex-shrink-0 w-44 h-44 md:w-[232px] md:h-[232px] shadow-2xl">
                            <img
                                src={getImageUrl(song.image)}
                                alt={song.name}
                                class="w-full h-full object-cover rounded-md"
                            />
                        </div>
                        
                        <!-- Song Info -->
                        <div class="flex-1 min-w-0 pb-2 text-center md:text-left w-full">
                            <p class="text-xs md:text-sm font-bold mb-1 md:mb-2">Song</p>
                            <h1 class="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-black mb-2 md:mb-6 break-words leading-tight">{song.name}</h1>
                            <div class="flex items-center gap-1 text-[11px] md:text-sm font-medium flex-wrap justify-center md:justify-start text-neutral-400">
                                <div class="font-bold text-white">
                                    {#if song.artists?.primary}
                                        {#each song.artists.primary as artist, i (artist.id)}
                                            <a href="/artist/{artist.id}" class="hover:underline text-white">{artist.name}</a>
                                            {#if i < song.artists.primary.length - 1},&nbsp;{/if}
                                        {/each}
                                    {/if}
                                </div>
                                {#if song.album?.name}
                                    <span class="mx-1">•</span>
                                    <a href="/album/{song.album.id}" class="hover:underline text-neutral-400">{song.album.name}</a>
                                {/if}
                                {#if song.duration}
                                    <span class="mx-1">•</span>
                                    <span>{formatDuration(song.duration)}</span>
                                {/if}
                                {#if song.playCount}
                                    <span class="mx-1">•</span>
                                    <span>{formatNumber(song.playCount)} listens</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Controls Section -->
        <div class="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-white/5">
            <div class="py-3 md:py-4 px-2 md:px-6">
                <div class="max-w-[1955px] mx-auto">
                    <div class="flex items-center gap-3 md:gap-8">
                        <button 
                            class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-green-500 flex items-center justify-center hover:scale-105 hover:bg-green-400 transition-transform active:scale-100 shadow-xl" 
                            on:click={() => playSong(song)}
                            aria-label="Play {song.name}"
                        >
                            <Play size={20} fill="currentColor" class="md:w-6 md:h-6 text-black ml-0.5" />
                        </button>
                        <button 
                            class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95" 
                            aria-label="Like song"
                        >
                            <Heart size={26} class="md:w-8 md:h-8" />
                        </button>
                        <button 
                            class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95 md:block hidden" 
                            aria-label="Add to playlist"
                        >
                            <Plus size={32} />
                        </button>
                        <button 
                            class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95 md:block hidden" 
                            aria-label="Share"
                        >
                            <Share2 size={28} />
                        </button>
                        <button 
                            class="text-neutral-400 hover:text-white transition-colors p-1.5 md:p-2 hover:scale-110 active:scale-95 ml-auto" 
                            aria-label="More options"
                        >
                            <MoreHorizontal size={26} class="md:w-8 md:h-8" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div class="py-4 md:py-6">
            <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                
                <!-- Other Tracks from Album -->
                {#if otherAlbumTracks && otherAlbumTracks.length > 0}
                    <div class="mb-8 md:mb-10">
                        <div class="flex justify-between items-end mb-3 md:mb-4">
                            <h2 class="text-xl md:text-2xl font-bold">More from <a href="/album/{song.album?.id}" class="hover:underline">{truncateText(song.album?.name || 'this Album', 15)}</a></h2>
                            <a href="/album/{song.album?.id}" class="text-xs md:text-sm text-neutral-400 hover:text-white font-bold">Show all</a>
                        </div>
                        
                        <!-- Desktop Table View -->
                        <div class="hidden md:block">
                            <div class="grid grid-cols-[16px_4fr_2fr_minmax(120px,1fr)] gap-4 px-4 py-2 text-sm text-neutral-400 border-b border-white/10">
                                <div>#</div>
                                <div>Title</div>
                                <div>Album</div>
                                <div class="flex justify-end pr-6">
                                    <Clock size={16} />
                                </div>
                            </div>
                            {#each otherAlbumTracks.slice(0, 5) as track, index}
                                <div
                                    class="grid grid-cols-[16px_4fr_2fr_minmax(120px,1fr)] gap-4 px-4 py-2 rounded hover:bg-white/10 group cursor-pointer items-center"
                                    on:click={() => handleTrackClick(track.id)}
                                    on:keypress={(e) => e.key === 'Enter' && handleTrackClick(track.id)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="text-neutral-400 text-sm flex items-center justify-center">
                                        <span class="group-hover:hidden">{index + 1}</span>
                                        <span
                                            class="hidden group-hover:block"
                                            on:click|stopPropagation={() => playSong(track)}
                                            on:keypress|stopPropagation={(e) => e.key === 'Enter' && playSong(track)}
                                            role="button"
                                            tabindex="0"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-3 min-w-0">
                                        <img src={getImageUrl(track.image)} alt={track.name} class="w-10 h-10 rounded" />
                                        <div class="min-w-0">
                                            <div class="font-medium truncate">{truncateText(track.name, 30)}</div>
                                            <div class="text-sm text-neutral-400 truncate">{track.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
                                        </div>
                                    </div>
                                    <div class="text-sm text-neutral-400 truncate">{truncateText(track.album?.name || song.album?.name, 25)}</div>
                                    <div class="text-sm text-neutral-400 text-right pr-6">{formatDuration(track.duration)}</div>
                                </div>
                            {/each}
                        </div>

                        <!-- Mobile List View -->
                        <div class="md:hidden space-y-1">
                            {#each otherAlbumTracks.slice(0, 5) as track}
                                <div
                                    class="flex items-center gap-2.5 p-2 rounded-lg active:bg-white/10"
                                    on:click={() => handleTrackClick(track.id)}
                                    on:keypress={(e) => e.key === 'Enter' && handleTrackClick(track.id)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <img src={getImageUrl(track.image)} alt={track.name} class="w-11 h-11 rounded flex-shrink-0" />
                                    <div class="flex-1 min-w-0">
                                        <div class="font-medium truncate text-sm">{truncateText(track.name, 25)}</div>
                                        <div class="text-xs text-neutral-400 truncate">{track.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
                                    </div>
                                    <button
                                        class="flex-shrink-0 p-1.5"
                                        on:click|stopPropagation={() => playSong(track)}
                                        aria-label="Play"
                                    >
                                        <Play size={18} />
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Lyrics Section -->
                {#if song.hasLyrics && song.lyricsId}
                    <div class="mb-8 md:mb-10">
                        <h2 class="text-xl md:text-2xl font-bold mb-3 md:mb-4">Lyrics</h2>
                        <div class="bg-gradient-to-br from-zinc-800 to-zinc-900 p-6 md:p-8 rounded-lg">
                            <p class="text-neutral-400 text-center text-sm md:text-base">Lyrics functionality coming soon...</p>
                        </div>
                    </div>
                {/if}

                <!-- Recommendations -->
                {#if suggestions && suggestions.length > 0}
                    <div class="mb-8 md:mb-10">
                        <h2 class="text-xl md:text-2xl font-bold mb-3 md:mb-4">Recommended</h2>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                            {#each suggestions.slice(0, 6) as suggestedSong}
                                <div
                                    class="bg-zinc-800/40 p-3 md:p-4 rounded-md hover:bg-zinc-800 transition-all cursor-pointer group"
                                    on:click={() => handleTrackClick(suggestedSong.id)}
                                    on:keypress={(e) => e.key === 'Enter' && handleTrackClick(suggestedSong.id)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="relative mb-3 md:mb-4">
                                        <img
                                            src={getImageUrl(suggestedSong.image)}
                                            alt={suggestedSong.name}
                                            class="w-full aspect-square object-cover rounded-md shadow-lg"
                                        />
                                        <div class="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                                            <button 
                                                class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center hover:scale-105 hover:bg-green-400 shadow-xl transition-transform active:scale-100" 
                                                on:click|stopPropagation={() => playSong(suggestedSong)}
                                                aria-label="Play"
                                            >
                                                <Play size={18} fill="currentColor" class="md:w-5 md:h-5 text-black ml-0.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div class="font-medium truncate text-xs md:text-sm mb-1">{truncateText(suggestedSong.name, 25)}</div>
                                    <div class="text-[11px] md:text-sm text-neutral-400 truncate">{suggestedSong.artists?.primary?.[0]?.name || 'Unknown Artist'}</div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>

    {:else}
        <div class="flex items-center justify-center min-h-screen">
            <div class="text-center">
                <div class="w-12 h-12 border-4 border-zinc-700 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-neutral-400">Loading song details...</p>
            </div>
        </div>
    {/if}
</div>