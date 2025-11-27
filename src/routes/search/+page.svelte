<script lang="ts">
    import type { PageData } from './$types.js';
    import { goto } from '$app/navigation';

    export let data: PageData;

    function handleSongClick(songId: string) {
        goto(`/song/${songId}`);
    }

    function handleAlbumClick(albumId: string) {
        goto(`/album/${albumId}`);
    }

    function handleArtistClick(artistId: string) {
        goto(`/artist/${artistId}`);
    }

    function handlePlaylistClick(playlistId: string) {
        goto(`/playlist/${playlistId}`);
    }

    function getEntityType(type: string): string {
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
</script>

<div class="min-h-screen bg-black text-white">
    <main class="px-4 py-6 md:px-6 lg:px-8 max-w-[1955px] mx-auto">
        {#if data.error}
            <div class="flex items-center justify-center min-h-[50vh]">
                <p class="text-red-500 text-lg">{data.error}</p>
            </div>
        {:else if data.results?.data}
            {#if data.results.data.topQuery?.results.length || data.results.data.songs?.results.length || data.results.data.artists?.results.length || data.results.data.albums?.results.length || data.results.data.playlists?.results.length}
                {@const results = data.results.data}
                
                <div class="mb-8">
                    <h1 class="text-2xl md:text-3xl font-bold mb-6">Search Results</h1>
                    
                    <!-- Top Query Result -->
                    {#if results.topQuery?.results.length}
                        {@const topResult = results.topQuery.results[0]}
                        <section class="mb-10">
                            <h2 class="text-xl md:text-2xl font-bold mb-4">Top result</h2>
                            
                            <!-- Mobile: Horizontal Card -->
                            <div 
                                class="md:hidden bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer flex items-center gap-4"
                                on:click={() => {
                                    if (topResult.type === 'song') handleSongClick(topResult.id);
                                    else if (topResult.type === 'album') handleAlbumClick(topResult.id);
                                    else if (topResult.type === 'artist') handleArtistClick(topResult.id);
                                    else if (topResult.type === 'playlist') handlePlaylistClick(topResult.id);
                                }}
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (topResult.type === 'song') handleSongClick(topResult.id);
                                        else if (topResult.type === 'album') handleAlbumClick(topResult.id);
                                        else if (topResult.type === 'artist') handleArtistClick(topResult.id);
                                        else if (topResult.type === 'playlist') handlePlaylistClick(topResult.id);
                                    }
                                }}
                            >
                                <img
                                    src={topResult.image?.[topResult.image.length - 1]?.url || 'https://via.placeholder.com/150'}
                                    alt={topResult.title}
                                    class="w-20 h-20 {topResult.type === 'artist' ? 'rounded-full' : 'rounded-md'} shadow-lg flex-shrink-0"
                                />
                                <div class="min-w-0 flex-1">
                                    <h3 class="text-xl font-bold mb-1 truncate">{topResult.title}</h3>
                                    <div class="flex items-center gap-2 text-sm text-zinc-400">
                                        <span>{getEntityType(topResult.type)}</span>
                                        {#if topResult.primaryArtists}
                                            <span>•</span>
                                            <span class="truncate">{topResult.primaryArtists}</span>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <!-- Desktop: Large Card -->
                            <div 
                                class="hidden md:block bg-linear-to-br from-zinc-800 to-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer group max-w-sm"
                                on:click={() => {
                                    if (topResult.type === 'song') handleSongClick(topResult.id);
                                    else if (topResult.type === 'album') handleAlbumClick(topResult.id);
                                    else if (topResult.type === 'artist') handleArtistClick(topResult.id);
                                    else if (topResult.type === 'playlist') handlePlaylistClick(topResult.id);
                                }}
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (topResult.type === 'song') handleSongClick(topResult.id);
                                        else if (topResult.type === 'album') handleAlbumClick(topResult.id);
                                        else if (topResult.type === 'artist') handleArtistClick(topResult.id);
                                        else if (topResult.type === 'playlist') handlePlaylistClick(topResult.id);
                                    }
                                }}
                            >
                                <img
                                    src={topResult.image?.[topResult.image.length - 1]?.url || 'https://via.placeholder.com/150'}
                                    alt={topResult.title}
                                    class="w-24 h-24 {topResult.type === 'artist' ? 'rounded-full' : 'rounded-md'} shadow-2xl mb-4"
                                />
                                <h3 class="text-3xl font-bold mb-2 truncate">{topResult.title}</h3>
                                <div class="flex items-center gap-2 text-sm text-zinc-300">
                                    <span>{getEntityType(topResult.type)}</span>
                                    {#if topResult.primaryArtists}
                                        <span>•</span>
                                        <span class="truncate">{topResult.primaryArtists}</span>
                                    {/if}
                                </div>
                            </div>
                        </section>
                    {/if}

                    <!-- Songs Section -->
                    {#if results.songs?.results.length}
                        <section class="mb-10">
                            <h2 class="text-xl md:text-2xl font-bold mb-4">Songs</h2>
                            <div class="space-y-2">
                                {#each results.songs.results.slice(0, 4) as song, i (song.id)}
                                    <div 
                                        class="grid grid-cols-[auto_48px_1fr_auto] md:grid-cols-[auto_56px_1fr_1fr_auto] gap-3 md:gap-4 items-center p-2 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer group"
                                        on:click={() => handleSongClick(song.id)}
                                        role="button"
                                        tabindex="0"
                                        on:keydown={(e) => e.key === 'Enter' && handleSongClick(song.id)}
                                    >
                                        <span class="text-zinc-400 text-sm w-6 text-right">{i + 1}</span>
                                        <img
                                            src={song.image?.[song.image.length - 1]?.url || 'https://via.placeholder.com/40'}
                                            alt={song.title}
                                            class="w-12 h-12 md:w-14 md:h-14 rounded"
                                        />
                                        <div class="min-w-0">
                                            <div class="font-medium truncate group-hover:text-green-400 transition-colors">{song.title}</div>
                                            <div class="text-sm text-zinc-400 truncate">{song.primaryArtists}</div>
                                        </div>
                                        <div class="hidden md:block text-sm text-zinc-400 truncate">{song.album}</div>
                                        <div class="text-sm text-zinc-400">
                                            {song.duration ? Math.floor(song.duration / 60) + ':' + String(song.duration % 60).padStart(2, '0') : ''}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </section>
                    {/if}
                </div>

                <!-- Artists Section -->
                {#if results.artists?.results.length}
                    <section class="mb-10">
                        <h2 class="text-xl md:text-2xl font-bold mb-4">Artists</h2>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                            {#each results.artists.results as artist (artist.id)}
                                <div 
                                    class="bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer group"
                                    on:click={() => handleArtistClick(artist.id)}
                                    role="button"
                                    tabindex="0"
                                    on:keydown={(e) => e.key === 'Enter' && handleArtistClick(artist.id)}
                                >
                                    <div class="relative mb-4">
                                        <img
                                            src={artist.image?.[artist.image.length - 1]?.url || 'https://via.placeholder.com/150'}
                                            alt={artist.title}
                                            class="w-full aspect-square rounded-full object-cover shadow-lg"
                                        />
                                    </div>
                                    <div class="font-semibold truncate mb-1">{artist.title}</div>
                                    <div class="text-sm text-zinc-400">Artist</div>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/if}

                <!-- Albums Section -->
                {#if results.albums?.results.length}
                    <section class="mb-10">
                        <h2 class="text-xl md:text-2xl font-bold mb-4">Albums</h2>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                            {#each results.albums.results as album (album.id)}
                                <div 
                                    class="bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer group"
                                    on:click={() => handleAlbumClick(album.id)}
                                    role="button"
                                    tabindex="0"
                                    on:keydown={(e) => e.key === 'Enter' && handleAlbumClick(album.id)}
                                >
                                    <div class="relative mb-4">
                                        <img
                                            src={album.image?.[album.image.length - 1]?.url || 'https://via.placeholder.com/150'}
                                            alt={album.title}
                                            class="w-full aspect-square rounded-md object-cover shadow-lg"
                                        />
                                    </div>
                                    <div class="font-semibold truncate mb-1">{album.title}</div>
                                    <div class="text-sm text-zinc-400 truncate">{album.artist}</div>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/if}

                <!-- Playlists Section -->
                {#if results.playlists?.results.length}
                    <section class="mb-10">
                        <h2 class="text-xl md:text-2xl font-bold mb-4">Playlists</h2>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                            {#each results.playlists.results as playlist (playlist.id)}
                                <div 
                                    class="bg-zinc-900 rounded-lg p-4 hover:bg-zinc-800 transition-all cursor-pointer group"
                                    on:click={() => handlePlaylistClick(playlist.id)}
                                    role="button"
                                    tabindex="0"
                                    on:keydown={(e) => e.key === 'Enter' && handlePlaylistClick(playlist.id)}
                                >
                                    <div class="relative mb-4">
                                        <img
                                            src={playlist.image?.[playlist.image.length - 1]?.url || 'https://via.placeholder.com/150'}
                                            alt={playlist.title}
                                            class="w-full aspect-square rounded-md object-cover shadow-lg"
                                        />
                                    </div>
                                    <div class="font-semibold truncate mb-1">{playlist.title}</div>
                                    <div class="text-sm text-zinc-400">Playlist</div>
                                </div>
                            {/each}
                        </div>
                    </section>
                {/if}
            {:else if data.query}
                <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                    <h3 class="text-2xl md:text-3xl font-bold mb-3">No results found for "{data.query}"</h3>
                    <p class="text-zinc-400 max-w-md">
                        Please make sure your words are spelled correctly, or use fewer or different keywords.
                    </p>
                </div>
            {/if}
        {:else}
            <div class="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
                <h2 class="text-3xl md:text-4xl font-bold mb-4">Search Musify</h2>
                <p class="text-zinc-400 text-lg">Find your favorite songs, artists, and albums.</p>
            </div>
        {/if}
    </main>
</div>