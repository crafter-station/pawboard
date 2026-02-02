"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Cat, MessageCircle, Trash2, Users, X } from "lucide-react";
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
import { ParticipantsList } from "@/components/participants-list";
import { ThreadList } from "@/components/threads/thread-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThreadWithDetails } from "@/db/schema";
import { useSidebarStore } from "@/stores/sidebar-store";
import { ChatMessages } from "./chat-messages";

// Stable default values to avoid creating new references on each render
const EMPTY_THREADS: ThreadWithDetails[] = [];
const EMPTY_PARTICIPANTS = new Map<string, string>();
const EMPTY_ONLINE_USERS = new Set<string>();

interface ChatPanelProps {
  sessionId: string;
  userId: string;
  threads?: ThreadWithDetails[];
  onThreadClick?: (threadId: string) => void;
  participants?: Map<string, string>;
  onlineUsers?: Set<string>;
  creatorId?: string;
}

export function ChatPanel({
  sessionId,
  userId,
  threads = EMPTY_THREADS,
  onThreadClick,
  participants = EMPTY_PARTICIPANTS,
  onlineUsers = EMPTY_ONLINE_USERS,
  creatorId,
}: ChatPanelProps) {
  const { isOpen, setOpen, toggle, activeTab, setActiveTab } =
    useSidebarStore();
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
    if (status === "ready" && messages.length > 0 && activeTab === "chat") {
      inputRef.current?.focus();
    }
  }, [status, messages.length, activeTab]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    inputRef.current?.focus();
  }, [setMessages]);

  // Error is already logged in onError callback above - no need for separate effect

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

  // Focus input when opening to chat tab
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab]);

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

  const handleThreadClick = useCallback(
    (threadId: string) => {
      onThreadClick?.(threadId);
    },
    [onThreadClick],
  );

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="h-full border-l border-border bg-background flex flex-col overflow-hidden shrink-0 z-[60] relative"
        >
          {/* Header with Tabs */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/50 shrink-0">
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "chat" | "threads" | "participants")
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="chat" className="text-xs gap-1.5 px-3">
                  <Cat className="w-3.5 h-3.5" />
                  AI Chat
                </TabsTrigger>
                <TabsTrigger value="threads" className="text-xs gap-1.5 px-3">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Threads
                </TabsTrigger>
                <TabsTrigger
                  value="participants"
                  className="text-xs gap-1.5 px-3"
                >
                  <Users className="w-3.5 h-3.5" />
                  People
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-1">
              {activeTab === "chat" && messages.length > 0 && (
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

          {/* Tab Content */}
          {activeTab === "chat" ? (
            <>
              {/* Chat Messages */}
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

              {/* Chat Input */}
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
            </>
          ) : activeTab === "threads" ? (
            /* Threads List */
            <ThreadList threads={threads} onThreadClick={handleThreadClick} />
          ) : (
            /* Participants List */
            <ParticipantsList
              participants={participants}
              currentUserId={userId}
              onlineUsers={onlineUsers}
              creatorId={creatorId}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Trigger button that appears when sidebar is closed
export function ChatTrigger() {
  const { isOpen, setOpen } = useSidebarStore();

  if (isOpen) return null;

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      onClick={() => setOpen(true)}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-primary text-primary-foreground p-2.5 rounded-l-lg shadow-lg hover:bg-primary/90 transition-colors"
      title="Open Sidebar (⌘I)"
    >
      <Cat className="w-5 h-5" />
    </motion.button>
  );
}
