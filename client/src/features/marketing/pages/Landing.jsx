import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Code2, LayoutDashboard, Flame, ListChecks, Users,
  ArrowRight, CheckCircle2, ImageIcon,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/shared/ui/button';

const FEATURES = [
  {
    Icon: LayoutDashboard,
    title: 'Progress dashboard',
    body: 'See solved counts, difficulty breakdowns, and topic coverage at a glance — your whole grind in one screen.',
  },
  {
    Icon: Flame,
    title: 'Activity heatmap',
    body: 'A GitHub-style calendar of every day you practiced, so streaks stay visible and momentum stays honest.',
  },
  {
    Icon: ListChecks,
    title: 'Problem tracking',
    body: 'Mark problems solved, revisiting, or to-do. Filter by topic and pattern instead of scrolling a spreadsheet.',
  },
  {
    Icon: Users,
    title: 'Study groups',
    body: 'Curate problem sets, share them, and track a group through a focused list together.',
  },
];

/**
 * A screenshot slot. Drop real PNGs into client/public/screenshots/ (see the
 * README there). Until then this renders a labelled placeholder so the layout is
 * already correct and a missing/failed image never shows a broken-image icon.
 */
const ScreenshotSlot = ({ src, alt, caption }) => {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/60 shadow-2xl shadow-black/40">
      {!failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-auto block"
        />
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-emerald-500/5 to-indigo-500/5 text-muted-foreground">
          <ImageIcon className="h-10 w-10 opacity-40" />
          <span className="text-sm font-medium">{alt}</span>
          <span className="text-xs opacity-60">{src}</span>
        </div>
      )}
      <figcaption className="border-t border-white/[0.06] px-4 py-3 text-center text-xs text-muted-foreground">
        {caption}
      </figcaption>
    </figure>
  );
};

const Landing = () => {
  const { user } = useAuth();

  // Already signed in? Skip the pitch.
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden animate-fade-in">
      {/* Decorative glows — mirror the auth pages so the brand feels consistent. */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-25%] right-[-10%] w-[500px] h-[400px] bg-indigo-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Code2 className="h-4.5 w-4.5" size={18} />
          </span>
          <span className="text-lg font-bold tracking-tight text-white">
            Leet<span className="text-emerald-400">Tracker</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" className="font-medium">Sign in</Button>
          </Link>
          <Link to="/register">
            <Button className="font-semibold">Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-16 pb-12 text-center sm:pt-24">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Track every problem. Keep every streak.
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          Your LeetCode grind,<br />
          <span className="text-emerald-400">finally organized.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          LeetTracker turns scattered practice into a clear picture — a progress
          dashboard, an activity heatmap, topic-level tracking, and shared study
          groups. Stop guessing what to review next.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register">
            <Button size="lg" className="w-full font-semibold sm:w-auto">
              Start tracking free
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="w-full font-semibold sm:w-auto">
              I already have an account
            </Button>
          </Link>
        </div>
      </section>

      {/* Product screenshots */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <ScreenshotSlot
            src="/screenshots/dashboard.png"
            alt="Dashboard preview"
            caption="The dashboard — solved counts, difficulty mix, and topic coverage in one view."
          />
          <ScreenshotSlot
            src="/screenshots/heatmap.png"
            alt="Activity heatmap preview"
            caption="The activity heatmap — a year of practice, one cell per day."
          />
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Everything you need to stay consistent
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built for people grinding interviews — not another spreadsheet to maintain.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/[0.08] bg-card/60 p-6 transition-colors hover:border-emerald-500/30"
            >
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <feature.Icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-emerald-500/[0.07] to-transparent p-10">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ready to see your progress?
          </h2>
          <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2.5 text-left text-sm text-muted-foreground">
            {['Free to use', 'Import your solved problems from LeetCode', 'No setup — sign up and start tracking'].map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
          <Link to="/register" className="mt-8 inline-block">
            <Button size="lg" className="font-semibold">
              Create your account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} LeetTracker</span>
          <span>Track. Review. Repeat.</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
