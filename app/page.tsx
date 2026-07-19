"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTracker } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { authReady, cloudEnabled, user, error, signInWithGoogle } = useTracker();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authReady && user) router.replace("/overview");
  }, [authReady, router, user]);

  async function login() {
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // The store exposes a user-friendly error.
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady) return <div className="center-screen"><div className="loader" /><p>Loading TrackBetter…</p></div>;

  return (
    <main className="login-page">
      <div className="login-top"><div className="brand simple"><span>TB</span><strong>TrackBetter</strong></div><ThemeToggle compact /></div>
      <section className="login-card">
        <div className="login-mark">✓</div>
        <p className="eyebrow">Your private workspace</p>
        <h1>Track your month. Improve steadily.</h1>
        <p className="login-copy">Manage income, spending, investments, habits and reports from one simple dashboard. Google login keeps your Firestore data synced across devices.</p>

        {cloudEnabled ? (
          <button className="google-button" onClick={login} disabled={submitting}>
            <span className="google-g">G</span>
            {submitting ? "Signing in…" : "Continue with Google"}
          </button>
        ) : (
          <div className="notice warning">Firebase is not configured. Add the six <code>NEXT_PUBLIC_FIREBASE_*</code> variables to enable Google login and cloud sync.</div>
        )}

        {error && <div className="form-message error">{error}</div>}
        <p className="privacy-note">Only your signed-in Google account can read and write your private tracker workspace.</p>
      </section>
    </main>
  );
}
