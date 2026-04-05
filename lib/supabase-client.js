/**
 * supabase-client.js
 * Initializes the Supabase client for the application.
 */

// We use the UMD build from the CDN which exposes `supabase` globally.
// The constants will be injected via build step or set here manually for now.
const SUPABASE_URL = 'https://tgerqxrerttzadzjuuub.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZXJxeHJlcnR0emFkemp1dXViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MDgxOTAsImV4cCI6MjA5MDk4NDE5MH0.8mIAQM9xfIWVtHiVMUgdpCv2fM09grEEjuGLVPIqoVk';

// Create a single supabase client for interacting with your database
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth state helper
window.currentUser = null;

// Listen for auth state changes
window.supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        window.currentUser = session.user;
        console.log('User signed in:', session.user.email);
        // Hide login, show app
        document.getElementById('supabase-auth-screen').style.display = 'none';
        
        // If we are on the landing screen, refresh the recent projects list, else go to landing
        const appContainer = document.getElementById('main-app-container');
        if (appContainer && appContainer.style.display === 'none') {
             document.getElementById('landing-screen').style.display = 'flex';
             if (window.ProjectStore) {
                 window.ProjectStore.listProjects().then(projects => {
                     if (window.renderRecentProjects) window.renderRecentProjects(projects);
                 });
             }
        }
    } else if (event === 'SIGNED_OUT') {
        window.currentUser = null;
        console.log('User signed out');
        // Show login, hide app
        document.getElementById('supabase-auth-screen').style.display = 'flex';
        document.getElementById('landing-screen').style.display = 'none';
        document.getElementById('main-app-container').style.display = 'none';
        if (window.ProjectStore) window.ProjectStore.clear(); // clear memory
    }
});
