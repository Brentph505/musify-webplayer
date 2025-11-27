<script>
    import Home from 'lucide-svelte/icons/home';
    import Search from 'lucide-svelte/icons/search';
    import Library from 'lucide-svelte/icons/library';
    import Plus from 'lucide-svelte/icons/plus';
    import ListMusic from 'lucide-svelte/icons/list-music';
    
    let activeFilter = 'Playlists';
    
    const filters = ['Playlists', 'Artists', 'Albums'];
    
    const playlists = [
        { name: 'Liked Songs', count: '234 songs' },
        { name: 'My Playlist #1', count: '45 songs' },
        { name: 'Chill Vibes', count: '67 songs' },
        { name: 'Workout Mix', count: '89 songs' },
        { name: 'Study Focus', count: '123 songs' },
    ];
</script>

<nav class="bg-black flex flex-col gap-2 h-full p-2">
    <!-- Top Navigation Section -->
    <div class="bg-[#121212] rounded-lg overflow-hidden">
        <ul class="flex flex-col py-2">
            <li>
                <a
                    href="/"
                    class="flex items-center gap-4 text-gray-400 hover:text-white font-bold transition-colors px-6 py-3 group"
                >
                    <Home size={24} class="group-hover:scale-110 transition-transform" />
                    <span>Home</span>
                </a>
            </li>
            <li>
                <a
                    href="/search"
                    class="flex items-center gap-4 text-gray-400 hover:text-white font-bold transition-colors px-6 py-3 group"
                >
                    <Search size={24} class="group-hover:scale-110 transition-transform" />
                    <span>Search</span>
                </a>
            </li>
        </ul>
    </div>

    <!-- Library Section -->
    <div class="bg-[#121212] rounded-lg flex-1 flex flex-col overflow-hidden">
        <!-- Library Header -->
        <div class="px-4 py-3">
            <button
                class="flex items-center gap-4 text-gray-400 hover:text-white font-bold w-full transition-colors group"
            >
                <Library size={24} class="group-hover:scale-110 transition-transform" />
                <span>Your Library</span>
            </button>
        </div>

        <!-- Action Buttons -->
        <div class="px-4 pb-2 flex items-center gap-2">
            <button
                class="w-8 h-8 rounded-full bg-[#242424] hover:bg-[#2a2a2a] flex items-center justify-center text-gray-400 hover:text-white transition-all"
                aria-label="Create playlist"
            >
                <Plus size={18} />
            </button>
            <button
                class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#2a2a2a] text-gray-400 hover:text-white text-sm font-semibold transition-all"
            >
                <ListMusic size={16} />
                <span class="hidden lg:inline">Create Playlist</span>
            </button>
        </div>

        <!-- Filter Chips -->
        <div class="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
            {#each filters as filter}
                <button
                    class="px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap"
                    class:bg-white={activeFilter === filter}
                    class:text-black={activeFilter === filter}
                    class:bg-[#242424]={activeFilter !== filter}
                    class:text-white={activeFilter !== filter}
                    class:hover:bg-[#2a2a2a]={activeFilter !== filter}
                    on:click={() => (activeFilter = filter)}
                >
                    {filter}
                </button>
            {/each}
        </div>

        <!-- Playlist List -->
        <div class="flex-1 overflow-y-auto px-2 custom-scrollbar">
            <ul class="flex flex-col">
                {#each playlists as playlist}
                    <li>
                        <a
                            href="/"
                            class="flex items-center gap-3 px-2 py-2 rounded hover:bg-[#1a1a1a] transition-colors group"
                        >
                            <div class="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                                <ListMusic size={24} class="text-white" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-white font-medium text-sm truncate group-hover:underline">
                                    {playlist.name}
                                </div>
                                <div class="text-gray-400 text-xs truncate">
                                    {playlist.count}
                                </div>
                            </div>
                        </a>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</nav>

<style>
    ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    /* Custom scrollbar styling */
    .custom-scrollbar::-webkit-scrollbar {
        width: 12px;
    }

    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: #282828;
        border-radius: 6px;
        border: 3px solid #121212;
    }

    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: #3e3e3e;
    }

    /* Hide scrollbar for filter chips */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }

    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    /* Smooth transitions */
    * {
        transition-property: background-color, color, transform;
        transition-duration: 0.2s;
        transition-timing-function: ease;
    }
</style>