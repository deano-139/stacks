import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch top 10 global scores
 */
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('username, score')
    .order('score', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}

/**
 * Submit or update a player's best score
 * Uses upsert so each user only has one row
 */
export async function submitScore(username, score) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to submit scores');

  // Check if user already has an entry
  const { data: existing } = await supabase
    .from('leaderboard')
    .select('score')
    .eq('username', username)
    .single();

  // Only update if new score is higher
  if (existing && existing.score >= score) return existing.score;

  const { data, error } = await supabase
    .from('leaderboard')
    .upsert({ username, score }, { onConflict: 'username' })
    .select()
    .single();

  if (error) throw error;
  return data.score;
}

/**
 * Sign up with email/password
 */
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  if (error) throw error;
  return data;
}

/**
 * Log in
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Log out
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}