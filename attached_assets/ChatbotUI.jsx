
import { useState } from 'react';

export default function ChatbotUI() {
  const [messages, setMessages] = useState([
    { role: 'system', text: "Hey, I'm Clean Machine Auto Detail. What can I help you with today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch("https://cleanmachinetul--your-project-name.replit.app/sms", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ Body: userMessage.text })
      });

      const reply = await res.text();
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="p-4 overflow-y-auto h-96">
          {messages.map((msg, i) => (
            <div key={i} className={`my-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && <div className="text-gray-400 text-sm mt-2">Clean Machine is typing...</div>}
        </div>
        <form onSubmit={handleSubmit} className="p-4 border-t flex">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 mr-2 focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
          />
          <button className="bg-blue-600 text-white px-4 py-2 rounded-xl" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
