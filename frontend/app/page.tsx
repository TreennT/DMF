"use client";

import Link from "next/link";

import { useLanguage } from "../components/language-provider";

export default function LandingPage() {
  const { content } = useLanguage();
  const { home } = content;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 transition-colors duration-300 dark:bg-slate-950 sm:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="space-y-4 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {home.badge}
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
            {home.title}
          </h1>
          <p className="max-w-3xl text-base text-slate-600 dark:text-slate-300 sm:text-lg">
            {home.description}
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
              <div className="absolute -left-24 -top-24 h-48 w-48 rounded-full bg-blue-100 blur-3xl dark:bg-blue-900/50" />
              <div className="absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-cyan-100 blur-3xl dark:bg-cyan-900/50" />
            </div>
            <div className="relative flex h-full flex-col gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">
                  {home.options.review.label}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  {home.options.review.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {home.options.review.description}
                </p>
              </div>
              <div className="mt-auto">
                <Link
                  href="/review"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:ring-offset-slate-950"
                >
                  {home.options.review.action}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </article>

          <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-lg transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100">
              <div className="absolute -left-20 -top-28 h-48 w-48 rounded-full bg-emerald-100 blur-3xl dark:bg-emerald-900/50" />
              <div className="absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-lime-100 blur-3xl dark:bg-lime-900/50" />
            </div>
            <div className="relative flex h-full flex-col gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
                  {home.options.mapping.label}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
                  {home.options.mapping.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {home.options.mapping.description}
                </p>
              </div>
              <div className="mt-auto">
                <Link
                  href="/mapping"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:ring-offset-slate-950"
                >
                  {home.options.mapping.action}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
