"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  Send,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatMessage, ChatMessageSkeleton } from "@/components/chat-message";
import { FileUploadZone } from "@/components/file-upload-zone";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { BoardFile } from "@/db/schema";
import { formatFileSize } from "@/lib/files/validation";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  sessionId: string;
  userId: string;
  selectedCardId?: string;
  onClose: () => void;
}

export function ChatPanel({
  sessionId,
  userId,
  selectedCardId,
  onClose,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [files, setFiles] = useState<BoardFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Create transport with custom body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          sessionId,
          userId,
          selectedCardId,
        },
      }),
    [sessionId, userId, selectedCardId],
  );

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    id: `chat-${sessionId}`,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Fetch files on mount and after uploads
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoadingFiles(true);
      const response = await fetch(
        `/api/files/list?sessionId=${sessionId}&userId=${userId}`,
      );
      const data = await response.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error("Failed to fetch files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [sessionId, userId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleFileUpload = useCallback(
    (_file: { id: string; filename: string }) => {
      fetchFiles();
    },
    [fetchFiles],
  );

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    sendMessage({ text: inputValue.trim() });
    setInputValue("");
  }, [inputValue, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold">AI Assistant</span>
          {selectedCardId && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              Card selected
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* File upload zone */}
      <div className="px-4 py-3 border-b border-border">
        <FileUploadZone
          sessionId={sessionId}
          userId={userId}
          onUploadComplete={handleFileUpload}
          disabled={isLoading}
        />

        {/* Files list */}
        {files.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Uploaded Files ({files.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchFiles}
                disabled={isLoadingFiles}
                className="h-6 px-2"
              >
                <RefreshCw
                  className={cn("w-3 h-3", isLoadingFiles && "animate-spin")}
                />
              </Button>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {files.map((file) => (
                <FileListItem key={file.id} file={file} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="px-4 py-4 space-y-1">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Start a conversation with your board.</p>
              <p className="text-xs mt-1">
                Ask questions, create cards, or search files.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {status === "submitted" && <ChatMessageSkeleton />}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error.message}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-auto h-7"
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your board..."
            disabled={isLoading}
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={stop}
              className="h-10 w-10 shrink-0"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              disabled={!inputValue.trim()}
              onClick={handleSend}
              className="h-10 w-10 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

interface FileListItemProps {
  file: BoardFile;
}

function FileListItem({ file }: FileListItemProps) {
  const StatusIcon =
    file.ingestionStatus === "completed"
      ? CheckCircle
      : file.ingestionStatus === "failed"
        ? AlertCircle
        : Clock;

  const statusColor =
    file.ingestionStatus === "completed"
      ? "text-green-500"
      : file.ingestionStatus === "failed"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
      <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="truncate flex-1" title={file.filename}>
        {file.filename}
      </span>
      <span className="text-muted-foreground shrink-0">
        {formatFileSize(file.sizeBytes)}
      </span>
      <StatusIcon className={cn("w-3 h-3 shrink-0", statusColor)} />
    </div>
  );
}
