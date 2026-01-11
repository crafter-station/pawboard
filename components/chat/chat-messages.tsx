"use client";

import type { ToolUIPart, UIMessage } from "ai";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

interface ChatMessagesProps {
  messages: UIMessage[];
}

type AnyToolPart = {
  type: `tool-${string}`;
  state: ToolUIPart["state"];
  input: unknown;
  output?: unknown;
  errorText?: string;
};

type ReasoningPart = {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <Message key={message.id} from={message.role}>
          <MessageContent>
            {message.parts.map((part, index) => {
              const key = `${message.id}-${index}`;

              // Reasoning/thinking display
              if (part.type === "reasoning") {
                const reasoningPart = part as ReasoningPart;
                return (
                  <Reasoning
                    key={key}
                    isStreaming={reasoningPart.state === "streaming"}
                  >
                    <ReasoningTrigger />
                    <ReasoningContent>{reasoningPart.text}</ReasoningContent>
                  </Reasoning>
                );
              }

              // Text content
              if (part.type === "text") {
                return <MessageResponse key={key}>{part.text}</MessageResponse>;
              }

              // Tool invocations
              if (part.type.startsWith("tool-")) {
                const toolPart = part as AnyToolPart;
                const toolName = part.type.replace("tool-", "");

                return (
                  <Tool key={key} defaultOpen={false}>
                    <ToolHeader
                      title={formatToolName(toolName)}
                      type={toolPart.type}
                      state={toolPart.state}
                    />
                    <ToolContent>
                      <ToolInput input={toolPart.input} />
                      {toolPart.state === "output-available" && (
                        <ToolOutput
                          output={toolPart.output}
                          errorText={undefined}
                        />
                      )}
                      {toolPart.state === "output-error" && (
                        <ToolOutput
                          output={undefined}
                          errorText={toolPart.errorText ?? "An error occurred"}
                        />
                      )}
                    </ToolContent>
                  </Tool>
                );
              }

              return null;
            })}
          </MessageContent>
        </Message>
      ))}
    </div>
  );
}

function formatToolName(toolName: string): string {
  const nameMap: Record<string, string> = {
    createCard: "Create Card",
    editCard: "Edit Card",
    deleteCards: "Delete Cards",
    moveCards: "Move Cards",
    changeColor: "Change Color",
    summarizeCards: "Summarize Cards",
    findSimilar: "Find Similar",
    clusterCards: "Cluster Cards",
  };

  return nameMap[toolName] || toolName;
}
