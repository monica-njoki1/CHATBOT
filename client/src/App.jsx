import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/";
const STORAGE_KEY = "chat-history-v1";

const createChat = () => ({
  id: crypto.randomUUID(),
  title: "New chat",
  messages: [],
});

function loadChats() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // ignore corrupted storage
  }
  return [createChat()];
}

export default function App() {
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => loadChats()[0].id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef(null);

  const active = chats.find((c) => c.id === activeId) || chats[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length, loading, activeId]);

  const updateChat = (id, fn) =>
    setChats((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  function startNewChat() {
    // reuse an existing empty chat instead of stacking blanks
    const empty = chats.find((c) => c.messages.length === 0);
    if (empty) {
      setActiveId(empty.id);
    } else {
      const chat = createChat();
      setChats((prev) => [chat, ...prev]);
      setActiveId(chat.id);
    }
    setMenuOpen(false);
  }

  function deleteChat(id) {
    const remaining = chats.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const chat = createChat();
      setChats([chat]);
      setActiveId(chat.id);
      return;
    }
    setChats(remaining);
    if (id === activeId) setActiveId(remaining[0].id);
  }

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const chatId = active.id;
    const history = active.messages
      .filter((m) => !m.error)
      .map(({ role, content }) => ({ role, content }));

    updateChat(chatId, (c) => ({
      ...c,
      title: c.messages.length === 0 ? text.slice(0, 32) : c.title,
      messages: [...c.messages, { role: "user", content: text }],
    }));
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      updateChat(chatId, (c) => ({
        ...c,
        messages: [...c.messages, { role: "assistant", content: data.reply }],
      }));
    } catch (err) {
      updateChat(chatId, (c) => ({
        ...c,
        messages: [
          ...c.messages,
          {
            role: "assistant",
            content: `Couldn't reach the server: ${err.message}`,
            error: true,
          },
        ],
      }));
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="grid h-dvh bg-white text-black md:grid-cols-[18rem_1fr]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex min-h-0 w-72 max-w-[85vw] flex-col gap-4 bg-black p-4 text-white transition-transform motion-reduce:transition-none md:static md:max-w-none md:translate-x-0 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          onClick={startNewChat}
          className="cursor-pointer rounded-xl bg-sky px-4 py-3 font-bold text-black hover:bg-sky-strong"
        >
          New chat
        </button>

        <nav
          aria-label="Chat history"
          className="flex min-h-0 flex-col gap-1 overflow-y-auto"
        >
          {chats.map((c) => {
            const current = c.id === active.id;
            return (
              <div
                key={c.id}
                className={`flex items-center rounded-lg border-l-[3px] hover:bg-neutral-900 ${
                  current ? "border-sky bg-neutral-900" : "border-transparent"
                }`}
              >
                <button
                  onClick={() => {
                    setActiveId(c.id);
                    setMenuOpen(false);
                  }}
                  className={`min-w-0 flex-1 cursor-pointer truncate px-3 py-2.5 text-left ${
                    current ? "font-semibold text-sky" : ""
                  }`}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => deleteChat(c.id)}
                  aria-label={`Delete chat: ${c.title}`}
                  className="cursor-pointer px-3 py-1.5 text-xl text-neutral-500 hover:text-white"
                >
                  ×
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-10 bg-black/50 md:hidden"
        />
      )}

      {/* Main */}
      <main className="flex h-full min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b-[3px] border-sky px-4 py-3 md:px-6 md:py-4">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open chat history"
            className="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-black text-white md:hidden"
          >
            ☰
          </button>
          <h1 className="truncate text-lg font-bold">{active.title}</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 p-4 md:p-6">
            {active.messages.length === 0 && (
              <p className="m-auto text-muted">
                Send a message to start chatting.
              </p>
            )}

            {active.messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : ""}`}
              >
                <div
                  className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 leading-relaxed md:max-w-[75%] ${
                    m.role === "user"
                      ? "rounded-br-sm bg-sky text-black"
                      : m.error
                        ? "rounded-bl-sm bg-black text-white"
                        : "rounded-bl-sm border-[1.5px] border-black bg-white"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex">
                <div
                  aria-label="Assistant is typing"
                  className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border-[1.5px] border-black px-4 py-4"
                >
                  {[0, 200, 400].map((delay) => (
                    <span
                      key={delay}
                      style={{ animationDelay: `${delay}ms` }}
                      className="size-2 animate-pulse rounded-full bg-sky-strong motion-reduce:animate-none"
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          onSubmit={send}
          className="mx-auto flex w-full max-w-3xl items-end gap-3 px-4 pb-4 pt-3 md:px-6 md:pb-6"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type a message"
            rows={1}
            aria-label="Message"
            className="max-h-40 flex-1 resize-none rounded-xl border-[1.5px] border-black bg-white px-4 py-3 text-black field-sizing-content placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="cursor-pointer rounded-xl bg-black px-5 py-3 font-bold text-sky hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}