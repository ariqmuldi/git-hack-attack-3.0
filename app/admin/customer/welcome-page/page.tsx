"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MessageStage = "greeting" | "party-size" | "reservation-prompt" | "buttons";

interface TypedMessage {
  text: string;
  displayedText: string;
  isComplete: boolean;
}

export default function WelcomePage() {
  const [partySize] = useState<number | null>(null);

  const [stage, setStage] = useState<MessageStage>("greeting");
  const [messages, setMessages] = useState<TypedMessage[]>([
    { text: "Welcome to Restaurant X", displayedText: "", isComplete: false },
  ]);
  const [showButtons, setShowButtons] = useState(false);

  const typingSpeed = 50;

  // Typing animation effect
  useEffect(() => {
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage || currentMessage.isComplete) return;

    const timeout = setTimeout(() => {
      const nextChar = currentMessage.text[currentMessage.displayedText.length];
      const updatedMessages = [...messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...currentMessage,
        displayedText: currentMessage.displayedText + nextChar,
      };
      if (updatedMessages[updatedMessages.length - 1].displayedText.length === currentMessage.text.length) {
        updatedMessages[updatedMessages.length - 1].isComplete = true;
      }
      setMessages(updatedMessages);
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [messages]);

  // Stage transition effect
  useEffect(() => {
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage?.isComplete) return;

    const transitionTimer = setTimeout(() => {
      switch (stage) {
        case "greeting":
          setStage("party-size");
          setMessages((prev) => [
            ...prev,
            {
              text: `We saw you have a party of ${partySize ?? "?"}.`,
              displayedText: "",
              isComplete: false,
            },
          ]);
          break;

        case "party-size":
          setStage("reservation-prompt");
          setMessages((prev) => [
            ...prev,
            {
              text: "Do you have a reservation?",
              displayedText: "",
              isComplete: false,
            },
          ]);
          break;

        case "reservation-prompt":
          setStage("buttons");
          setShowButtons(true);
          break;

        case "buttons":
          break;
      }
    }, 2000);

    return () => clearTimeout(transitionTimer);
  }, [stage, messages, partySize]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 font-sans antialiased text-black">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-10 md:px-10">
        {/* Header */}
        <header className="mb-20 flex items-center justify-between">
          <p className="text-2xl font-semibold tracking-tight">Restaurant X</p>
          <p className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">
            Kiosk Check-in
          </p>
        </header>

        {/* Conversation Container */}
        <section className="flex flex-col items-center justify-center min-h-[500px]">
          <div className="w-full max-w-2xl space-y-6">
            {messages.length > 0 && (
              <div className="animate-fade-in">
                <h1 className="text-4xl md:text-6xl font-bold text-black leading-tight tracking-tight min-h-[80px]">
                  {messages[messages.length - 1].displayedText}
                  {!messages[messages.length - 1].isComplete && (
                    <span className="animate-pulse">|</span>
                  )}
                </h1>
              </div>
            )}

            {showButtons && (
              <div className="mt-12 flex flex-col gap-4 sm:flex-row animate-fade-in">
                <Link
                  href="/admin/customer/confirm-reservation"
                  className="flex-1 rounded-lg bg-black px-8 py-5 text-center text-base font-semibold text-white transition hover:bg-zinc-800 active:bg-black"
                >
                  Yes, I do
                </Link>
                <Link
                  href="/admin/customer/table-free"
                  className="flex-1 rounded-lg border-2 border-black bg-white px-8 py-5 text-center text-base font-semibold text-black transition hover:bg-black hover:text-white"
                >
                  No reservation
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </main>
  );
}
