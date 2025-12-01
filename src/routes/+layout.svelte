<script lang="ts">
    import './layout.css';
    import Sidebar from '$lib/components/Sidebar.svelte';
    import Player from '$lib/components/Player.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import { audioEffectsStore } from '$lib/stores/audioEffectsStore.js';
    import { onMount } from 'svelte';

    onMount(() => {
        const handleBeforeUnload = () => {
            audioEffectsStore.destroy();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            audioEffectsStore.destroy();
        };
    });
</script>

<div class="app-layout">
    <div class="sidebar-layout">
        <Sidebar />
    </div>
    <main class="main-layout">
        <Navbar />
        <div>
            <slot />
        </div>
        <div class="bottom-fade" />
    </main>
    <div class="player-layout">
        <Player />
    </div>
</div>

<style>
    :global(body) {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
            'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        background-color: black;
        color: #fff;
    }

    .app-layout {
        height: 100vh;
        display: grid;
        grid-template-rows: 1fr auto;
        grid-template-columns: auto 1fr;
        grid-template-areas:
            'sidebar main'
            'player player';
        gap: 8px;
        padding: 8px;
        overflow: hidden;
        box-sizing: border-box;
    }

    .sidebar-layout {
        grid-area: sidebar;
        width: 300px;
        overflow: hidden;
    }

    .main-layout {
        grid-area: main;
        overflow-y: auto;
        background-color: #121212;
        border-radius: 8px;

        /* NEW: Custom Scrollbar Styles */
        /* Webkit (Chrome, Safari, Edge) */
        &::-webkit-scrollbar {
            width: 8px; /* Width of the scrollbar */
            height: 8px; /* Height for horizontal scrollbar if needed */
        }

        &::-webkit-scrollbar-track {
            background: #121212; /* Color of the scrollbar track */
            border-radius: 10px;
        }

        &::-webkit-scrollbar-thumb {
            background-color: #4a4a4a; /* Color of the scrollbar thumb */
            border-radius: 10px; /* Roundness of the thumb */
            border: 2px solid #121212; /* Padding around the thumb */
        }

        &::-webkit-scrollbar-thumb:hover {
            background-color: #6a6a6a; /* Color of the thumb on hover */
        }

        /* Firefox (for future compatibility, though less customizable) */
        scrollbar-width: thin; /* "auto" or "thin" */
        scrollbar-color: #4a4a4a #121212; /* thumb color track color */
    }

    .player-layout {
        grid-area: player;
    }

    .bottom-fade {
        position: sticky;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 6rem; /* 96px */
        background: linear-gradient(to top, #121212, transparent);
        pointer-events: none;
    }

    @media (max-width: 768px) {
        .app-layout {
            grid-template-columns: 1fr;
            grid-template-areas:
                'main'
                'player';
            padding: 0;
            gap: 0;
        }

        .sidebar-layout {
            display: none;
        }
    }
</style>
