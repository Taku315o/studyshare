"use client";

import supabase from "@/lib/supabase";

export default function LoginPage() {
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) alert(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ padding: 24 }}>
      <button onClick={signInWithGoogle}>Sign in with Google</button>
      <button onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button>
    </div>
  );
}
