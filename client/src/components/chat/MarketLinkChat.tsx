import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Glyph } from '../art/glyphs';

type ChatMessage = { role: 'user' | 'model'; text: string };

const START_MESSAGE: ChatMessage = {
  role: 'model',
  text: 'Hi! I can help you find your way around MarketLink, browse local farmers and products, and understand market pickup.',
};

function DancingMarketBot() {
  return (
    <span className="ml-chat-bot" aria-hidden="true">
      <span className="ml-chat-bot__antenna" />
      <span className="ml-chat-bot__leaf"><Glyph name="leaf" size={13} /></span>
      <span className="ml-chat-bot__face"><i /><i /></span>
      <span className="ml-chat-bot__cheek ml-chat-bot__cheek--left" />
      <span className="ml-chat-bot__cheek ml-chat-bot__cheek--right" />
      <span className="ml-chat-bot__mouth" />
      <span className="ml-chat-bot__arm ml-chat-bot__arm--left" />
      <span className="ml-chat-bot__arm ml-chat-bot__arm--right" />
    </span>
  );
}

export function MarketLinkChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([START_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scrollArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, busy]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    const next = [...messages, { role: 'user' as const, text }];
    setMessages(next);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? '/api'}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-9).map(({ role, text: message }) => ({ role, text: message })) }),
      });
      const body = await response.json() as { reply?: string; error?: string | { message?: string } };
      const errorMessage = typeof body.error === 'string' ? body.error : body.error?.message;
      if (!response.ok || !body.reply) throw new Error(errorMessage || 'The MarketLink assistant could not reply. Try again.');
      setMessages((current) => [...current, { role: 'model', text: body.reply! }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reach the MarketLink assistant. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <section aria-label="MarketLink assistant" className="flex h-[min(72svh,38rem)] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-[0_24px_70px_rgba(15,39,27,0.24)]">
          <header className="flex items-center gap-3 bg-[#0d2b20] px-4 py-3 text-white">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5"><DancingMarketBot /></span>
            <div className="min-w-0 flex-1"><h2 className="font-display font-bold">MarketLink helper</h2><p className="mt-0.5 text-xs text-white/70">Farmers · markets · shopping help</p></div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-white/80 hover:bg-white/10">×</button>
          </header>
          <div ref={scrollArea} role="log" aria-live="polite" aria-label="Chat messages" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-sheet p-3.5">
            {messages.map((message, index) => (
              <div key={`${index}:${message.role}`} className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto rounded-br-md bg-accent text-paper' : 'mr-auto rounded-bl-md border border-line bg-white text-primary'}`}>
                {message.text}
              </div>
            ))}
            {busy ? <p className="mr-auto rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-2.5 text-sm text-muted">Thinking…</p> : null}
          </div>
          <form onSubmit={(event) => void send(event)} className="border-t border-line bg-white p-3">
            {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
            <div className="flex items-end gap-2">
              <label className="sr-only" htmlFor="marketlink-chat-message">Ask about MarketLink</label>
              <textarea id="marketlink-chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={1500} rows={1} placeholder="Ask about MarketLink…" className="max-h-28 min-h-11 flex-1 resize-y rounded-2xl border border-line bg-sheet px-3.5 py-3 text-sm text-primary outline-none focus:border-accent/50" />
              <button type="submit" aria-label="Send message" disabled={busy || !draft.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-paper transition hover:bg-[#18573b] disabled:opacity-45"><Glyph name="send" size={18} /></button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted">MarketLink topics only · Avoid sharing private information</p>
          </form>
        </section>
      ) : null}
      <button type="button" aria-label={open ? 'Close MarketLink helper' : 'Chat with MarketLink'} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-16 w-16 place-items-center rounded-full border border-white/70 bg-accent text-paper shadow-[0_12px_32px_rgba(33,106,73,0.35)] transition hover:scale-105 active:scale-95">
        {open ? <span aria-hidden="true" className="text-3xl leading-none">×</span> : <DancingMarketBot />}
      </button>
    </div>
  );
}
