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

<div class="min-h-screen bg-[#121212] text-white">
    {#if artist}
        <!-- Hero Section with Artist Image -->
        <div class="relative overflow-hidden">
            <!-- Gradient Background -->
            <div 
                class="absolute inset-0 bg-cover bg-center blur-[50px] opacity-30 scale-110"
                style="background-image: url({getImageUrl(artist.image)})"
            ></div>
            
            <!-- Gradient Overlay -->
            <div class="absolute inset-0 bg-gradient-to-b from-green-900/40 via-zinc-900/80 to-zinc-900"></div>
            
            <!-- Content -->
            <div class="relative pt-12 pb-4 md:pt-16">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <!-- Mobile: Stacked Layout -->
                    <div class="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-end">
                        <!-- Artist Image -->
                        <div class="flex-shrink-0 w-44 h-44 md:w-[232px] md:h-[232px] shadow-2xl rounded-full overflow-hidden">
                            <img
                                src={getImageUrl(artist.image)}
                                alt={artist.name}
                                class="w-full h-full object-cover"
                            />
                        </div>
                        
                        <!-- Artist Info -->
                        <div class="flex-1 min-w-0 pb-2 text-center md:text-left w-full">
                            <!-- Verified Badge -->
                            <p class="flex items-center justify-center md:justify-start gap-2 text-xs md:text-sm font-bold mb-1 md:mb-2 text-[#1ed760]">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                </svg>
                                Verified Artist
                            </p>
                            
                            <!-- Artist Name -->
                            <h1 class="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-black mb-2 md:mb-6 break-words leading-tight">
                                {artist.name}
                            </h1>
                            
                            <!-- Stats -->
                            <div class="flex items-center gap-1 text-[11px] md:text-sm font-medium flex-wrap justify-center md:justify-start text-neutral-400">
                                {#if artist.followerCount}
                                    <span class="font-bold text-white">{formatNumber(artist.followerCount)} followers</span>
                                {/if}
                                {#if artist.dominantLanguage}
                                    <span class="mx-1">•</span>
                                    <span>{artist.dominantLanguage}</span>
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
                            on:click={playArtistTopSong}
                            aria-label="Play artist's top songs"
                        >
                            <Play size={20} fill="currentColor" class="md:w-6 md:h-6 text-black ml-0.5" />
                        </button>
                        
                        <button 
                            class="px-4 md:px-6 py-2 rounded-full border border-neutral-400 hover:border-white hover:scale-105 transition-all flex items-center gap-2 text-xs md:text-sm font-bold h-8"
                            aria-label="Follow artist"
                        >
                            <UserPlus size={14} class="md:w-4 md:h-4" />
                            <span>Follow</span>
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

        <!-- Top Songs Section -->
        {#if topSongs && topSongs.length > 0}
            <div class="py-4 md:py-6">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <h2 class="text-xl md:text-2xl font-bold mb-3 md:mb-4">Popular</h2>
                    
                    <!-- Desktop Table View -->
                    <div class="hidden md:block">
                        <div class="flex flex-col gap-2">
                            {#each topSongs.slice(0, 5) as song, index (song.id)}
                                <div
                                    class="grid grid-cols-[16px_4fr_2fr_minmax(120px,1fr)] gap-4 px-4 py-2 rounded hover:bg-white/10 group cursor-pointer items-center"
                                    on:click={() => handleSongClick(song.id)}
                                    on:keypress={(e) => e.key === 'Enter' && handleSongClick(song.id)}
                                    role="button"
                                    tabindex="0"
                                    aria-label="Play {song.name}"
                                >
                                    <div class="text-neutral-400 text-sm flex items-center justify-center">
                                        <span class="group-hover:hidden">{index + 1}</span>
                                        <span
                                            class="hidden group-hover:block"
                                            on:click|stopPropagation={() => playSong(song)}
                                            on:keypress|stopPropagation={(e) => e.key === 'Enter' && playSong(song)}
                                            role="button"
                                            tabindex="0"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-3 min-w-0">
                                        <img src={getImageUrl(song.image)} alt={song.name} class="w-10 h-10 rounded flex-shrink-0" />
                                        <div class="min-w-0 flex-1">
                                            <div class="font-medium truncate group-hover:text-green-500">
                                                {song.name}
                                            </div>
                                            <div class="text-sm text-neutral-400 truncate">
                                                {(song as any).playCount ? formatNumber((song as any).playCount) : ''}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-sm text-neutral-400 truncate">
                                        {song.album?.name || 'Single'}
                                    </div>
                                    <div class="text-sm text-neutral-400 text-right pr-6">
                                        {#if song.duration}
                                            {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    <!-- Mobile List View -->
                    <div class="md:hidden space-y-1">
                        {#each topSongs.slice(0, 5) as song}
                            <div
                                class="flex items-center gap-2.5 p-2 rounded-lg active:bg-white/10"
                                on:click={() => handleSongClick(song.id)}
                                on:keypress={(e) => e.key === 'Enter' && handleSongClick(song.id)}
                                role="button"
                                tabindex="0"
                            >
                                <img src={getImageUrl(song.image)} alt={song.name} class="w-11 h-11 rounded flex-shrink-0" />
                                <div class="flex-1 min-w-0">
                                    <div class="font-medium truncate text-sm">{song.name}</div>
                                    <div class="text-xs text-neutral-400 truncate">
                                        {(song as any).playCount ? formatNumber((song as any).playCount) : ''}
                                    </div>
                                </div>
                                <button
                                    class="flex-shrink-0 p-1.5"
                                    on:click|stopPropagation={() => playSong(song)}
                                    aria-label="Play"
                                >
                                    <Play size={18} />
                                </button>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}

        <!-- Discography Section -->
        {#if topAlbums && topAlbums.length > 0}
            <div class="py-4 md:py-6">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <div class="flex justify-between items-end mb-3 md:mb-4">
                        <h2 class="text-xl md:text-2xl font-bold">Discography</h2>
                        <button class="text-xs md:text-sm font-bold text-neutral-400 hover:text-white transition-colors">
                            See all
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
                        {#each topAlbums.slice(0, 6) as album (album.id)}
                            <div
                                class="bg-zinc-800/40 p-3 md:p-4 rounded-md hover:bg-zinc-800 transition-all cursor-pointer group"
                                on:click={() => handleAlbumClick(album.id)}
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => e.key === 'Enter' && handleAlbumClick(album.id)}
                                aria-label="View album {album.name}"
                            >
                                <div class="relative mb-3 md:mb-4">
                                    <img
                                        src={getImageUrl(album.image)}
                                        alt={album.name}
                                        class="w-full aspect-square object-cover rounded shadow-lg"
                                    />
                                    
                                    <!-- Play Button Overlay -->
                                    <div class="absolute bottom-2 right-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                                        <button 
                                            class="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 hover:bg-green-400 hover:scale-105 transition-transform active:scale-100 flex items-center justify-center shadow-xl"
                                            aria-label="Play album"
                                            on:click|stopPropagation
                                        >
                                            <Play size={18} fill="currentColor" class="md:w-5 md:h-5 text-black ml-0.5" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="min-w-0">
                                    <div class="font-medium truncate text-xs md:text-sm mb-1">
                                        {album.name}
                                    </div>
                                    <div class="text-[11px] md:text-sm text-neutral-400">
                                        {album.year || ''} • {album.type || 'Album'}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}

        <!-- Artist Bio Section -->
        {#if artist.bio && artist.bio.length > 0}
            <div class="py-4 md:py-6">
                <div class="max-w-[1955px] mx-auto px-2 md:px-6">
                    <h2 class="text-xl md:text-2xl font-bold mb-3 md:mb-4">About</h2>
                    
                    <div class="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 md:gap-8 bg-zinc-800/40 p-4 md:p-6 rounded-lg">
                        <!-- Bio Image -->
                        <div class="w-full rounded-lg overflow-hidden">
                            <img 
                                src={getImageUrl(artist.image)} 
                                alt={artist.name}
                                class="w-full h-auto"
                            />
                        </div>
                        
                        <!-- Bio Content -->
                        <div class="flex flex-col gap-4">
                            {#if artist.followerCount}
                                <div class="flex gap-8">
                                    <div>
                                        <div class="text-4xl md:text-5xl font-black leading-none mb-2">
                                            {formatNumber(artist.followerCount)}
                                        </div>
                                        <div class="text-xs md:text-sm text-neutral-400">
                                            Followers
                                        </div>
                                    </div>
                                </div>
                            {/if}
                            
                            <p class="text-xs md:text-sm leading-relaxed text-neutral-400">
                                {artist.bio[0].text}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

    {:else}
        <div class="py-24 px-8 text-center text-[#a7a7a7]">
            <p>Loading artist details...</p>
        </div>
    {/if}
</div>