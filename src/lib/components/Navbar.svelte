<script lang="ts">
    import User from 'lucide-svelte/icons/user';
    import Search from 'lucide-svelte/icons/search';
    import ChevronLeft from 'lucide-svelte/icons/chevron-left';
    import ChevronRight from 'lucide-svelte/icons/chevron-right';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';

    let inputValue = $page.url.searchParams.get('query') || '';
    let isInputFocused = false;
    let searchInputRef: HTMLInputElement;
    let navbarSearchActive = false;

    $: showSearchInputForm = $page.url.pathname.startsWith('/search') || navbarSearchActive;

    $: {
        if (showSearchInputForm && searchInputRef && !isInputFocused) {
            searchInputRef.focus();
        }
    }

    $: {
        const urlQuery = $page.url.searchParams.get('query') || '';
        if (!isInputFocused && urlQuery !== inputValue) {
            inputValue = urlQuery;
        }
    }

    function handleFocus() {
        isInputFocused = true;
    }

    function handleBlur() {
        isInputFocused = false;
        if (inputValue.trim() === '' && !$page.url.pathname.startsWith('/search')) {
            navbarSearchActive = false;
        }
    }

    function handleSearch() {
        const trimmedValue = inputValue.trim();
        if (trimmedValue) {
            goto(`/search?query=${encodeURIComponent(trimmedValue)}`);
            navbarSearchActive = false;
        } else if ($page.url.pathname.startsWith('/search')) {
            goto('/search');
        } else {
            navbarSearchActive = false;
        }
    }

    function goBack() {
        window.history.back();
    }

    function goForward() {
        window.history.forward();
    }
</script>

<header
    class="sticky top-0 z-30 flex justify-between items-center px-4 md:px-6 h-16 bg-gradient-to-b from-black/80 to-black/60 backdrop-blur-md"
>
    <!-- Left Section: Navigation & Search -->
    <div class="flex items-center gap-3 flex-1">
        <!-- Navigation Arrows -->
        <div class="flex items-center gap-2">
            <button
                on:click={goBack}
                class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
                aria-label="Go back"
            >
                <ChevronLeft size={20} />
            </button>
            <button
                on:click={goForward}
                class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
                aria-label="Go forward"
            >
                <ChevronRight size={20} />
            </button>
        </div>

        <!-- Search Section -->
        {#if showSearchInputForm}
            <form on:submit|preventDefault={handleSearch} class="relative w-full max-w-sm">
                <div class="relative">
                    <Search 
                        size={16} 
                        class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 pointer-events-none"
                    />
                    <input
                        type="text"
                        placeholder="What do you want to listen to?"
                        bind:value={inputValue}
                        bind:this={searchInputRef}
                        on:focus={handleFocus}
                        on:blur={handleBlur}
                        class="w-full bg-white text-black placeholder:text-gray-600 rounded-full py-2.5 pl-10 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white transition-all"
                    />
                </div>
            </form>
        {:else}
            <button
                on:click={() => (navbarSearchActive = true)}
                class="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-all duration-200 hover:scale-105"
                aria-label="Open search"
            >
                <Search size={18} />
            </button>
        {/if}
    </div>

    <!-- Right Section: Upgrade & Profile -->
    <div class="flex items-center gap-2">
        <!-- Desktop buttons -->
        <button
            class="hidden md:flex bg-transparent border border-gray-600 hover:border-white text-white font-bold rounded-full py-2 px-6 text-sm transition-all duration-200 hover:scale-105"
        >
            Sign up
        </button>
        <button
            class="hidden md:flex bg-white hover:bg-gray-100 text-black font-bold rounded-full py-2 px-6 text-sm transition-all duration-200 hover:scale-105"
        >
            Log in
        </button>
        
        <!-- Mobile: Only profile button -->
        <button
            class="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
            aria-label="User profile"
        >
            <User size={18} />
        </button>
    </div>
</header>

<style>
    header {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    input::placeholder {
        font-weight: 500;
    }

    button {
        cursor: pointer;
        user-select: none;
    }

    button:active {
        transform: scale(0.95);
    }
</style>