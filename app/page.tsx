'use client';

import { useEffect, useMemo, useState } from 'react';
import { FOODS, type FoodItem } from '../data/foods';
import { deleteLog, listLogsByDate, putLog, type LogEntry } from '../lib/db';
import { formatDateKey, sumMacros, uid } from '../lib/utils';

interface CustomEntryState {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  quantity: string;
  unit: string;
  notes: string;
}

const initialCustom: CustomEntryState = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  quantity: '1',
  unit: 'serving',
  notes: ''
};

export default function Home() {
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()));
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') {
      return true;
    }
    return navigator.onLine;
  });
  const [custom, setCustom] = useState<CustomEntryState>(initialCustom);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    FOODS.reduce<Record<string, number>>((acc, food) => {
      acc[food.id] = food.defaultQuantity;
      return acc;
    }, {})
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const next = await listLogsByDate(selectedDateKey);
        setLogs(next);
      } catch (error) {
        console.error('Failed to load logs', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedDateKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const filteredFoods = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return FOODS.filter((food) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        food.name.toLowerCase().includes(normalizedQuery) ||
        food.description.toLowerCase().includes(normalizedQuery) ||
        food.tags.some((tag) => tag.includes(normalizedQuery));
      const matchesTag = !tagFilter || food.tags.includes(tagFilter);
      return matchesQuery && matchesTag;
    });
  }, [query, tagFilter]);

  const totals = useMemo(() => sumMacros(logs), [logs]);

  const tags = useMemo(() => {
    const unique = new Set<string>();
    FOODS.forEach((food) => food.tags.forEach((tag) => unique.add(tag)));
    return Array.from(unique).sort();
  }, []);

  const handleQuantityChange = (foodId: string, nextValue: number) => {
    setQuantities((prev) => ({
      ...prev,
      [foodId]: Math.max(0.25, Number.isFinite(nextValue) ? nextValue : 0.25)
    }));
  };

  const handleAddFood = async (food: FoodItem) => {
    const quantity = quantities[food.id] ?? food.defaultQuantity;
    const factor = quantity / food.defaultQuantity;
    const now = new Date();
    const createdAt = new Date(`${selectedDateKey}T${now.toTimeString().slice(0, 8)}`);

    const entry: LogEntry = {
      id: uid('food'),
      name: food.name,
      foodId: food.id,
      calories: Math.round(food.calories * factor),
      protein: Number((food.protein * factor).toFixed(1)),
      carbs: Number((food.carbs * factor).toFixed(1)),
      fats: Number((food.fats * factor).toFixed(1)),
      quantity,
      unit: food.unit,
      createdAt: createdAt.toISOString(),
      notes: food.description
    };

    await putLog(entry);
    const next = await listLogsByDate(selectedDateKey);
    setLogs(next);
  };

  const handleCustomSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(custom.quantity) || 1;
    const now = new Date();
    const createdAt = new Date(`${selectedDateKey}T${now.toTimeString().slice(0, 8)}`);

    const entry: LogEntry = {
      id: uid('custom'),
      name: custom.name || 'Untitled Meal',
      calories: Number(custom.calories) || 0,
      protein: Number(custom.protein) || 0,
      carbs: Number(custom.carbs) || 0,
      fats: Number(custom.fats) || 0,
      quantity,
      unit: custom.unit || 'serving',
      createdAt: createdAt.toISOString(),
      notes: custom.notes || undefined
    };

    await putLog(entry);
    const next = await listLogsByDate(selectedDateKey);
    setLogs(next);
    setCustom(initialCustom);
  };

  const handleDelete = async (id: string) => {
    await deleteLog(id);
    setLogs((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="glass rounded-3xl border border-slate-800 px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">LocalPlate</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-200 sm:text-base">
              A lean, offline-friendly tracker built for local plates and privacy-first nutrition.
              Log anything in seconds, even with zero signal.
            </p>
          </div>
          <div className="space-y-2 text-right text-sm text-slate-300">
            <p>{isOnline ? 'Synced. Working offline ready.' : 'Offline mode. All changes stored locally.'}</p>
            <p>Daily nutrition stays on your device. No ads, no paywalls.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm text-slate-300">
            Tracking date
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 shadow-sm"
              value={selectedDateKey}
              onChange={(event) => setSelectedDateKey(event.target.value)}
            />
          </label>
          <dl className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-4">
            {[
              { label: 'Calories', value: `${totals.calories} kcal` },
              { label: 'Protein', value: `${totals.protein.toFixed(1)} g` },
              { label: 'Carbs', value: `${totals.carbs.toFixed(1)} g` },
              { label: 'Fats', value: `${totals.fats.toFixed(1)} g` }
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                <dt className="text-xs uppercase text-slate-400">{item.label}</dt>
                <dd className="text-lg font-semibold text-slate-100">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="glass rounded-3xl border border-slate-800 px-6 py-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Local food catalogue</h2>
              <p className="text-sm text-slate-300">South Asian staples curated and ready to log offline.</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <input
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100"
                placeholder="Search masala dosa, dal, biryani..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                type="button"
                className="rounded-2xl border border-brand-light px-4 py-2 text-sm font-medium text-brand-light transition hover:bg-brand-light/10"
                onClick={() => {
                  setQuery('');
                  setTagFilter(null);
                }}
              >
                Reset
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = tagFilter === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter((current) => (current === tag ? null : tag))}
                  className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide transition ${
                    selected ? 'bg-brand text-slate-50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredFoods.map((food) => (
              <div key={food.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{food.name}</h3>
                    <p className="text-xs uppercase tracking-wide text-brand-light">
                      {food.locale.join(' • ')}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                    {food.calories} kcal / {food.defaultQuantity} {food.unit}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{food.description}</p>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-slate-200">
                  <div className="rounded-xl bg-slate-800/80 px-2 py-2">
                    <dt className="text-[10px] uppercase text-slate-400">Protein</dt>
                    <dd className="font-semibold">{food.protein} g</dd>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 px-2 py-2">
                    <dt className="text-[10px] uppercase text-slate-400">Carbs</dt>
                    <dd className="font-semibold">{food.carbs} g</dd>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 px-2 py-2">
                    <dt className="text-[10px] uppercase text-slate-400">Fats</dt>
                    <dd className="font-semibold">{food.fats} g</dd>
                  </div>
                  <div className="rounded-xl bg-slate-800/80 px-2 py-2">
                    <dt className="text-[10px] uppercase text-slate-400">Tags</dt>
                    <dd className="font-semibold">{food.tags.slice(0, 2).join(', ')}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-xs text-slate-300">
                    Qty ({food.unit})
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      className="mt-1 w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      value={quantities[food.id]}
                      onChange={(event) => handleQuantityChange(food.id, Number(event.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddFood(food)}
                    className="ml-auto inline-flex items-center gap-2 rounded-2xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
            {filteredFoods.length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-300">
                Nothing found. Try a different keyword or clear the filters.
              </p>
            )}
          </div>
        </article>

        <aside className="flex flex-col gap-6">
          <section className="glass rounded-3xl border border-slate-800 px-5 py-5">
            <h2 className="text-lg font-semibold text-white">Custom quick add</h2>
            <p className="mt-1 text-xs text-slate-300">
              Homemade recipe? Street food without labels? Log it manually once and you are set.
            </p>
            <form className="mt-4 space-y-3 text-sm text-slate-200" onSubmit={handleCustomSubmit}>
              <label className="flex flex-col gap-1">
                Name
                <input
                  required
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="Grandma&apos;s khichdi"
                  value={custom.name}
                  onChange={(event) => setCustom((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  Quantity
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.quantity}
                    onChange={(event) => setCustom((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Unit
                  <input
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.unit}
                    onChange={(event) => setCustom((prev) => ({ ...prev, unit: event.target.value }))}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  Calories (kcal)
                  <input
                    type="number"
                    min="0"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.calories}
                    onChange={(event) => setCustom((prev) => ({ ...prev, calories: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Protein (g)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.protein}
                    onChange={(event) => setCustom((prev) => ({ ...prev, protein: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Carbs (g)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.carbs}
                    onChange={(event) => setCustom((prev) => ({ ...prev, carbs: event.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Fats (g)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    value={custom.fats}
                    onChange={(event) => setCustom((prev) => ({ ...prev, fats: event.target.value }))}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                Notes
                <textarea
                  rows={2}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="Add spices, prep methods, or cooking oils."
                  value={custom.notes}
                  onChange={(event) => setCustom((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-2xl bg-brand py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
              >
                Save entry
              </button>
            </form>
          </section>

          <section className="glass rounded-3xl border border-slate-800 px-5 py-5">
            <h2 className="text-lg font-semibold text-white">Day plan targets</h2>
            <p className="mt-1 text-xs text-slate-300">
              Hit your macros with a balanced plate: 25% protein, 35% fats, 40% carbs.
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                <span>Calories goal</span>
                <span className="font-semibold">2000 kcal</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                <span>Protein target</span>
                <span className="font-semibold">125 g</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                <span>Carbs lane</span>
                <span className="font-semibold">200 g</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-900/70 px-4 py-3">
                <span>Fats ceiling</span>
                <span className="font-semibold">78 g</span>
              </div>
            </div>
          </section>
        </aside>
      </section>

      <section className="glass rounded-3xl border border-slate-800 px-6 py-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Daily log</h2>
            <p className="text-sm text-slate-300">
              Every meal is stored locally. Delete with a swipe and edit in a tap (coming soon).
            </p>
          </div>
          <span className="rounded-full border border-slate-700 px-4 py-1 text-xs font-medium uppercase tracking-wide text-slate-300">
            {selectedDateKey}
          </span>
        </div>

        {loading ? (
          <p className="mt-8 animate-pulse text-sm text-slate-300">Loading logs…</p>
        ) : logs.length === 0 ? (
          <p className="mt-8 text-sm text-slate-300">
            Nothing logged yet. Start with a dosa, biryani, or add a custom recipe.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {logs.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="flex-1">
                  <p className="text-base font-semibold text-white">{entry.name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {entry.quantity} {entry.unit} • {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {entry.notes && <p className="mt-2 text-xs text-slate-300">{entry.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-center text-xs font-semibold text-slate-100">
                  <span className="rounded-xl bg-slate-800/70 px-3 py-2">{entry.calories} kcal</span>
                  <span className="rounded-xl bg-slate-800/70 px-3 py-2">{entry.protein} g P</span>
                  <span className="rounded-xl bg-slate-800/70 px-3 py-2">{entry.carbs} g C</span>
                  <span className="rounded-xl bg-slate-800/70 px-3 py-2">{entry.fats} g F</span>
                </div>
                <button
                  type="button"
                  className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-300 transition hover:bg-red-500/10"
                  onClick={() => handleDelete(entry.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
