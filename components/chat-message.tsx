"use client";

import {
  type DynamicToolUIPart,
  getToolName,
  isToolUIPart,
  type TextUIPart,
  type ToolUIPart,
  type UIMessage,
  type UITools,
} from "ai";
import { Bot, CheckCircle, Loader2, User, Wrench, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: UIMessage;
  isLast?: boolean;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  // Extract text content from parts
  const textContent = message.parts
    .filter((part): part is TextUIPart => part.type === "text")
    .map((part) => part.text)
    .join("");

  // Extract tool parts using SDK helper
  const toolParts = message.parts.filter(
    (part): part is ToolUIPart<UITools> | DynamicToolUIPart =>
      isToolUIPart(part),
  );

  return (
    <div className={cn("flex gap-3 py-4", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex-1 space-y-2 min-w-0", isUser && "text-right")}>
        {/* Text content */}
        {textContent && (
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              isUser
                ? "bg-primary text-primary-foreground inline-block max-w-[90%]"
                : "bg-muted text-foreground",
            )}
          >
            {isAssistant ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-words [&_p]:break-words">
                <ReactMarkdown>{textContent}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap break-words">
                {textContent}
              </p>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {toolParts.length > 0 && (
          <div className="space-y-2">
            {toolParts.map((toolPart, index) => (
              <ToolInvocationDisplay
                key={`tool-${index}`}
                toolPart={toolPart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ToolPartType = ToolUIPart<UITools> | DynamicToolUIPart;

interface ToolInvocationDisplayProps {
  toolPart: ToolPartType;
}

function ToolInvocationDisplay({ toolPart }: ToolInvocationDisplayProps) {
  // In AI SDK v6, tool properties are spread directly on the part
  const toolName = getToolName(toolPart);
  const { state } = toolPart;

  const toolDisplayName = getToolDisplayName(toolName);
  const isLoading = state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

  // Type-safe output handling using type narrowing
  let outputMessage: string | undefined;
  let isSuccess = true;

  if (state === "output-available") {
    const output = (toolPart as { output: unknown }).output as
      | Record<string, unknown>
      | undefined;
    outputMessage = output?.message as string | undefined;
    isSuccess = output?.success !== false;
  } else if (state === "output-error") {
    outputMessage = (toolPart as { errorText: string }).errorText;
    isSuccess = false;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs p-2 rounded-md",
        "bg-muted/50 border border-border/50",
      )}
    >
      <div className="flex items-center gap-1.5">
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        ) : isSuccess ? (
          <CheckCircle className="w-3 h-3 text-green-500" />
        ) : (
          <XCircle className="w-3 h-3 text-destructive" />
        )}
        <Wrench className="w-3 h-3 text-muted-foreground" />
      </div>

      <span className="font-medium">{toolDisplayName}</span>

      {(hasOutput || hasError) && outputMessage && (
        <span className="text-muted-foreground truncate max-w-[200px]">
          {outputMessage}
        </span>
      )}
    </div>
  );
}

function getToolDisplayName(toolName: string): string {
  const names: Record<string, string> = {
    create_card: "Creating card",
    update_card: "Updating card",
    grep_files: "Searching files",
    read_file: "Reading file",
    list_files: "Listing files",
    summarize_context: "Summarizing",
  };
  return names[toolName] || toolName;
}

// Loading skeleton for streaming
export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Thinking...</span>
        </div>
      </div>
    </div>
  );
}
