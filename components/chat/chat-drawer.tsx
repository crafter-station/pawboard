"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Cat, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/stores/chat-store";
import { ChatMessages } from "./chat-messages";

interface ChatPanelProps {
  sessionId: string;
  userId: string;
}

export function ChatPanel({ sessionId, userId }: ChatPanelProps) {
  const { isOpen, setOpen, toggle } = useChatStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { sessionId, userId },
      }),
    [sessionId, userId],
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport,
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Auto-focus input after each response completes
  useEffect(() => {
    if (status === "ready" && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [status, messages.length]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    inputRef.current?.focus();
  }, [setMessages]);

  useEffect(() => {
    if (error) {
      console.error("useChat error state:", error);
    }
  }, [error]);

  // Keyboard shortcut: Cmd+I / Ctrl+I
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        if (
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLInputElement
        ) {
          const target = e.target as HTMLElement;
          if (!target.closest("[data-chat-input]")) {
            return;
          }
        }
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && isOpen) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, isOpen, setOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() || isLoading) return;

      try {
        await sendMessage({ text: message.text });
        setInputValue("");
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    },
    [isLoading, sendMessage],
  );

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="h-full border-l border-border bg-background flex flex-col overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 shrink-0">
            <div className="flex items-center gap-2">
              <Cat className="w-5 h-5 text-primary" />
              <span className="font-medium">Paw Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <Conversation className="flex-1 min-h-0">
            {error && (
              <div className="p-3 m-4 rounded-lg bg-destructive/10 text-destructive text-sm">
                Error: {error.message}
              </div>
            )}
            {messages.length === 0 && !error ? (
              <ConversationEmptyState
                icon={<Cat className="w-12 h-12 opacity-20" />}
                title="How can I help with your board?"
                description='Try: "Add a card about..." or "Summarize all cards"'
              />
            ) : (
              <ConversationContent className="gap-4">
                <ChatMessages messages={messages} />
              </ConversationContent>
            )}
            <ConversationScrollButton />
          </Conversation>

          {/* Input */}
          <div className="border-t border-border p-4 bg-card/30 shrink-0">
            <PromptInput
              onSubmit={handleSubmit}
              className="rounded-lg border border-border bg-background"
            >
              <PromptInputTextarea
                ref={inputRef}
                data-chat-input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your cards..."
                className="min-h-[44px] max-h-[120px] resize-none border-0 focus-visible:ring-0"
                disabled={isLoading}
              />
              <PromptInputFooter className="p-2">
                <p className="text-xs text-muted-foreground">
                  Press{" "}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">
                    ⌘I
                  </kbd>{" "}
                  to toggle
                </p>
                <PromptInputSubmit
                  status={status}
                  disabled={!inputValue.trim() || isLoading}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Trigger button that appears when chat is closed
export function ChatTrigger() {
  const { isOpen, setOpen } = useChatStore();

  if (isOpen) return null;

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setOpen(true)}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground p-2.5 rounded-l-lg shadow-lg hover:bg-primary/90 transition-colors"
      title="Open Paw Assistant (⌘I)"
    >
      <Cat className="w-5 h-5" />
    </motion.button>
  );
}
