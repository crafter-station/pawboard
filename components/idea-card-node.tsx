"use client";

import NumberFlow from "@number-flow/react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  Check,
  ChevronUp,
  Copy,
  CopyPlus,
  Crown,
  GripVertical,
  MessageSquarePlus,
  Smile,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CardEditHistoryDialog } from "@/components/card-edit-history-dialog";
import { CardEditor } from "@/components/card-editor";
import { CardThreadNode } from "@/components/threads/card-thread-node";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VoiceTrigger, VoiceVisualizer } from "@/components/voice-recorder";
import type { TiptapContent } from "@/db/schema";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import {
  DARK_COLORS,
  getDisplayColor as getDisplayColorUtil,
  LIGHT_COLORS,
} from "@/lib/colors";
import {
  canChangeColor,
  canDeleteCard,
  canEditCard,
  canMoveCard,
  canReact,
  canRefine,
  canVote,
} from "@/lib/permissions";
import type { IdeaCardNodeData } from "@/lib/react-flow-utils";
import {
  createTiptapContent,
  extractTextFromTiptap,
  isContentEmpty,
} from "@/lib/tiptap-utils";
import { cn, getAvatarForUser } from "@/lib/utils";

const REACTION_EMOJIS = ["👍", "❤️", "🔥", "💡", "🎯"] as const;

// Resize constraints
const MIN_WIDTH = 150;
const MAX_WIDTH = 600;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 400;

export interface IdeaCardNodeCallbacks {
  onType: (id: string, content: TiptapContent) => void;
  onChangeColor: (id: string, color: string) => void;
  onDelete: (id: string) => void;
  onVote: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onPersistContent: (id: string, content: TiptapContent) => void;
  onPersistColor: (id: string, color: string) => void;
  onPersistDelete: (id: string) => void;
  onDuplicate?: (cardId: string) => void;
  onFocused?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onPersistResize?: (id: string, width: number, height: number) => void;
  onAddThread?: (cardId: string) => void;
}

// Store callbacks in a ref to avoid prop drilling through React Flow
let globalCallbacks: IdeaCardNodeCallbacks | null = null;

export function setIdeaCardNodeCallbacks(callbacks: IdeaCardNodeCallbacks) {
  globalCallbacks = callbacks;
}

function IdeaCardNodeComponent({
  id,
  data,
  selected,
}: NodeProps<Node<IdeaCardNodeData>>) {
  const {
    card,
    session,
    userRole,
    visitorId,
    creatorName,
    autoFocus,
    attachedThreads,
    threadHandlers,
    magneticHighlight,
  } = data as IdeaCardNodeData;

  const nodeData = data as IdeaCardNodeData;

  const [isEditing, setIsEditing] = useState(nodeData.isEditing);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const originalContentRef = useRef<TiptapContent | null>(null);
  const { resolvedTheme } = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);

  /* Voice Recorder Hook */
  const {
    isRecording: isRecordingVoice,
    isTranscribing: isTranscribingVoice,
    audioLevels,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    onTranscription: (text) => {
      // Append transcribed text as a new paragraph to existing content
      const existingText = extractTextFromTiptap(card.content);
      const newText = existingText ? `${existingText}\n${text}` : text;
      const newContent = createTiptapContent(newText);
      globalCallbacks?.onType(card.id, newContent);
      globalCallbacks?.onPersistContent(card.id, newContent);
    },
  });

  // Permission checks
  const isOwnCard = card.createdById === visitorId;
  const hasVoted = card.votedBy?.includes(visitorId) || false;
  const role = userRole ?? "participant";
  const allowMove = canMoveCard(session, card, visitorId, role);
  const allowEdit = canEditCard(session, card, visitorId, role);
  const allowDelete = canDeleteCard(session, card, visitorId, role);
  const allowChangeColor = canChangeColor(session, card, visitorId, role);
  const allowRefine = canRefine(session, card, visitorId, role);
  const allowVote = canVote(session, card, visitorId, role);
  const allowReact = canReact(session, card, visitorId, role);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      const isMobileSize = window.innerWidth < 1024;
      const isTouch =
        typeof window !== "undefined" &&
        ("ontouchstart" in window || navigator.maxTouchPoints > 0);
      setIsMobile(isMobileSize || isTouch);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Helper to start editing - captures original content for change detection
  const startEditing = useCallback(() => {
    if (!isEditing && allowEdit) {
      originalContentRef.current = card.content;
      setIsEditing(true);
    }
  }, [isEditing, allowEdit, card.content]);

  // Auto-focus new cards
  useEffect(() => {
    if (autoFocus && allowEdit) {
      startEditing();
      globalCallbacks?.onFocused?.(id);
    }
  }, [autoFocus, allowEdit, id, startEditing]);

  // Get editors from props (fetched at session level in react-flow-board)
  const editors = data.editors ?? [];

  const isDark = mounted && resolvedTheme === "dark";
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const displayColor = getDisplayColorUtil(card.color, isDark, mounted);
  const creatorAvatar = getAvatarForUser(card.createdById);

  const handleContentChange = (content: TiptapContent) => {
    globalCallbacks?.onType(card.id, content);
  };

  const handleContentBlur = () => {
    setIsEditing(false);
    // Only persist if content actually changed
    const original = originalContentRef.current;
    if (original && JSON.stringify(card.content) !== JSON.stringify(original)) {
      globalCallbacks?.onPersistContent(card.id, card.content);
    }
    originalContentRef.current = null;
  };

  const handleColorChange = (color: string) => {
    globalCallbacks?.onChangeColor(card.id, color);
    globalCallbacks?.onPersistColor(card.id, color);
  };

  const handleDelete = () => {
    globalCallbacks?.onDelete(card.id);
    globalCallbacks?.onPersistDelete(card.id);
  };

  const handleDuplicate = () => {
    globalCallbacks?.onDuplicate?.(card.id);
  };

  const handleVote = () => {
    if (allowVote) {
      globalCallbacks?.onVote(card.id);
    }
  };

  const handleReact = (emoji: string) => {
    if (allowReact) {
      globalCallbacks?.onReact(card.id, emoji);
    }
  };

  const handleCopy = async () => {
    const textContent = extractTextFromTiptap(card.content);
    if (!textContent.trim()) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  };

  const getCursorStyle = () => {
    if (!allowMove) return "default";
    return "grab";
  };

  const handleAddThread = () => {
    globalCallbacks?.onAddThread?.(card.id);
  };

  // Resize handlers
  const handleResizeStart = useCallback(
    (e: React.PointerEvent, handle: string) => {
      if (!allowMove) return; // Use move permission for resize
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      setResizeHandle(handle);
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: card.width,
        height: card.height,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [allowMove, card.width, card.height],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing || !resizeHandle) return;

      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;

      let newWidth = resizeStartRef.current.width;
      let newHeight = resizeStartRef.current.height;

      if (resizeHandle.includes("e")) {
        newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, resizeStartRef.current.width + deltaX),
        );
      }
      if (resizeHandle.includes("s")) {
        newHeight = Math.max(
          MIN_HEIGHT,
          Math.min(MAX_HEIGHT, resizeStartRef.current.height + deltaY),
        );
      }

      globalCallbacks?.onResize?.(card.id, newWidth, newHeight);
    },
    [isResizing, resizeHandle, card.id],
  );

  const handleResizeEnd = useCallback(
    (e: React.PointerEvent) => {
      if (!isResizing) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsResizing(false);
      setResizeHandle(null);
      globalCallbacks?.onPersistResize?.(card.id, card.width, card.height);
    },
    [isResizing, card.id, card.width, card.height],
  );

  const isPurpleCard =
    card.color === LIGHT_COLORS[0] || card.color === DARK_COLORS[0];
  const isPurpleDark = isPurpleCard && isDark;
  const textColorClass = isPurpleDark ? "text-white" : "text-stone-800";
  const mutedTextClass = isPurpleDark ? "text-white/70" : "text-stone-600";
  const borderClass = isPurpleDark ? "border-white/20" : "border-stone-900/10";
  const iconClass = isPurpleDark ? "text-white/80" : "text-stone-500";
  const hoverBgClass = isPurpleDark
    ? "hover:bg-white/15"
    : "hover:bg-stone-900/8";
  const actionsBgClass = isDark
    ? isMobile
      ? "bg-black/10"
      : "bg-transparent group-hover:bg-black/10"
    : isMobile
      ? "bg-stone-900/5"
      : "bg-transparent group-hover:bg-stone-900/5";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={cardRef}
          data-card
          className="group touch-none select-none"
          style={{
            width: card.width,
            height: card.height,
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH,
            minHeight: MIN_HEIGHT,
            maxHeight: MAX_HEIGHT,
          }}
        >
          {/* Hidden handles for potential future edge connections */}
          <Handle type="target" position={Position.Top} className="!hidden" />
          <Handle
            type="source"
            position={Position.Bottom}
            className="!hidden"
          />

          <div
            className={cn(
              "rounded-lg shadow-lg transition-shadow hover:shadow-xl relative overflow-hidden h-full flex flex-col",
              selected && "ring-2 ring-offset-2 ring-primary",
              isResizing && "ring-2 ring-primary",
              magneticHighlight &&
                "ring-2 ring-offset-2 ring-sky-400 animate-pulse",
            )}
            style={{ backgroundColor: displayColor }}
          >
            {/* Cat silhouette background based on card creator's avatar */}
            <div
              className="absolute bottom-1 right-1 w-16 h-16 sm:w-20 sm:h-20 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage: `url(${creatorAvatar})`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "bottom right",
              }}
            />
            <div
              className={`flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 border-b ${borderClass}`}
              style={{
                cursor: getCursorStyle(),
              }}
            >
              <GripVertical
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass} ${
                  isPurpleDark
                    ? "opacity-70"
                    : isDark
                      ? "opacity-50"
                      : "opacity-40"
                }`}
              />
              <TooltipProvider delayDuration={400}>
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-md ${actionsBgClass} transition-all duration-200 nodrag`}
                >
                  {allowChangeColor && (
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 ${
                                isDark ? "border-white/30" : "border-black/20"
                              } ${
                                isMobile
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              } transition-all cursor-pointer hover:scale-110 hover:border-black/40`}
                              style={{ backgroundColor: displayColor }}
                            />
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Color</TooltipContent>
                      </Tooltip>
                      <PopoverContent
                        className="w-auto p-2 z-1001"
                        align="end"
                        sideOffset={5}
                      >
                        <div className="flex gap-1.5 sm:gap-2">
                          {colors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 hover:scale-110 transition-all cursor-pointer"
                              style={{
                                backgroundColor: color,
                                borderColor:
                                  displayColor === color
                                    ? "rgba(0,0,0,0.5)"
                                    : "transparent",
                              }}
                              onClick={() => handleColorChange(color)}
                            />
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {globalCallbacks?.onDuplicate && allowEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          onClick={handleDuplicate}
                          whileTap={{ scale: 0.9 }}
                          whileHover={{ scale: 1.1 }}
                          className={`p-1 sm:p-1.5 rounded-md ${
                            isMobile
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } ${hoverBgClass} transition-all cursor-pointer`}
                        >
                          <CopyPlus
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                          />
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Duplicate</TooltipContent>
                    </Tooltip>
                  )}
                  {allowDelete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          onClick={handleDelete}
                          whileTap={{ scale: 0.9 }}
                          whileHover={{ scale: 1.1 }}
                          className={`p-1 sm:p-1.5 rounded-md ${
                            isMobile
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          } ${hoverBgClass} transition-all cursor-pointer`}
                        >
                          <X
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                          />
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Delete</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TooltipProvider>
            </div>
            <div
              className={cn(
                "p-2.5 sm:p-3.5 relative flex-1 min-h-0 flex flex-col antialiased transition-[box-shadow] duration-200",
                isEditing && "nodrag",
              )}
              style={
                isEditing
                  ? { boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.08)" }
                  : undefined
              }
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: Complex card content container with conditional interactivity */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: Keyboard nav handled by CardEditor */}
              <div
                className={cn(
                  "flex-1 min-h-0 overflow-y-auto nowheel",
                  isEditing && "nodrag nopan",
                  !isEditing && allowEdit && "cursor-pointer",
                )}
                onClick={startEditing}
              >
                {isContentEmpty(card.content) && !isEditing ? (
                  <span className={mutedTextClass}>
                    {allowEdit
                      ? isMobile
                        ? "Tap to edit..."
                        : "Click to add idea..."
                      : "No content yet"}
                  </span>
                ) : (
                  <CardEditor
                    content={card.content}
                    onChange={handleContentChange}
                    onBlur={handleContentBlur}
                    editable={isEditing && allowEdit}
                    autoFocus={isEditing}
                    placeholder="Type your idea..."
                    className={cn(
                      "text-[11px] sm:text-[13px] leading-relaxed h-full",
                      textColorClass,
                    )}
                    cardId={card.id}
                    userId={visitorId}
                    allowRefine={allowRefine}
                  />
                )}
              </div>
              {/* Centered Voice Visualizer - Outside of Footer Transform Context */}
              <VoiceVisualizer
                isRecording={isRecordingVoice}
                audioLevels={audioLevels}
                isDark={isPurpleDark || isDark}
                containerClassName="absolute inset-0"
              />

              {!isContentEmpty(card.content) && !isEditing && (
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        onClick={handleCopy}
                        initial={{ opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`absolute bottom-2 right-2 p-1.5 rounded-md ${
                          isMobile
                            ? "opacity-70"
                            : "opacity-0 group-hover:opacity-70"
                        } hover:opacity-100 ${hoverBgClass} transition-all cursor-pointer`}
                      >
                        <AnimatePresence mode="wait">
                          {isCopied ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-500" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="copy"
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.5, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <Copy
                                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${iconClass}`}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {isCopied ? "Copied!" : "Copy"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {Object.keys(card.reactions).length > 0 && (
              <div
                className={`flex flex-wrap gap-1 px-2.5 sm:px-3.5 py-1.5 border-t ${borderClass} mt-auto`}
              >
                {Object.entries(card.reactions).map(([emoji, userIds]) => {
                  const userIdsList = userIds as string[];
                  const hasReacted = userIdsList.includes(visitorId);
                  return (
                    <motion.button
                      key={emoji}
                      type="button"
                      onClick={() => handleReact(emoji)}
                      disabled={!allowReact && !hasReacted}
                      whileTap={{ scale: 0.9 }}
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] sm:text-[11px] transition-all ${
                        hasReacted
                          ? "bg-stone-900/15 cursor-pointer"
                          : allowReact
                            ? `${hoverBgClass} cursor-pointer`
                            : "opacity-50 cursor-default"
                      }`}
                    >
                      <span>{emoji}</span>
                      <span className={`font-medium ${mutedTextClass}`}>
                        {userIdsList.length}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
            <div
              className={`flex items-center justify-between px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-t ${borderClass} ${Object.keys(card.reactions).length === 0 ? "mt-auto" : ""}`}
              style={{
                cursor: getCursorStyle(),
              }}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <CardEditHistoryDialog
                  cardId={card.id}
                  creatorId={card.createdById}
                  trigger={
                    <button
                      type="button"
                      className={`flex items-center gap-0.5 ${hoverBgClass} rounded p-0.5 transition-colors cursor-pointer nodrag`}
                    >
                      {/* Show editors or creator if no editors yet */}
                      {editors.length > 0 ? (
                        <>
                          {editors.slice(0, 3).map((editor, index) => {
                            const isCreator =
                              editor.userId === card.createdById;
                            return (
                              <div
                                key={editor.userId}
                                className="relative"
                                style={{ marginLeft: index > 0 ? -4 : 0 }}
                              >
                                <Image
                                  src={getAvatarForUser(editor.userId)}
                                  alt={`${editor.username}'s avatar`}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 sm:w-5 sm:h-5 rounded-sm"
                                  draggable={false}
                                />
                                {isCreator && (
                                  <Crown
                                    className={`absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 ${
                                      isPurpleDark
                                        ? "text-amber-300"
                                        : "text-amber-500"
                                    }`}
                                    fill="currentColor"
                                  />
                                )}
                              </div>
                            );
                          })}
                          {editors.length > 3 && (
                            <span
                              className={`text-[9px] sm:text-[10px] ${mutedTextClass} ml-0.5`}
                            >
                              +{editors.length - 3}
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="relative">
                          <Image
                            src={getAvatarForUser(card.createdById)}
                            alt={`${creatorName}'s avatar`}
                            width={16}
                            height={16}
                            className="w-4 h-4 sm:w-5 sm:h-5 rounded-sm"
                            draggable={false}
                          />
                          <Crown
                            className={`absolute -top-1 -right-1 w-2 h-2 sm:w-2.5 sm:h-2.5 ${
                              isPurpleDark ? "text-amber-300" : "text-amber-500"
                            }`}
                            fill="currentColor"
                          />
                        </div>
                      )}
                    </button>
                  }
                />
                {allowEdit && (
                  <TooltipProvider delayDuration={400}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.div
                          initial={{ opacity: 0.5, scale: 1 }}
                          animate={{
                            opacity: isRecordingVoice ? 1 : 0.5,
                            scale: 1,
                          }}
                          whileHover={{ opacity: 0.8, scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 25,
                          }}
                          className="flex-shrink-0 ml-0.5 z-10 nodrag"
                        >
                          <VoiceTrigger
                            isRecording={isRecordingVoice}
                            isTranscribing={isTranscribingVoice}
                            onToggle={
                              isRecordingVoice ? stopRecording : startRecording
                            }
                            isDark={isPurpleDark || isDark}
                          />
                        </motion.div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {isRecordingVoice ? "Stop recording" : "Voice input"} (
                        {navigator.platform?.includes("Mac")
                          ? "\u2318"
                          : "Ctrl"}
                        +.)
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <TooltipProvider delayDuration={400}>
                <div className="flex items-center gap-1 sm:gap-1.5 nodrag">
                  {allowReact && (
                    <Popover>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <PopoverTrigger asChild>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.1 }}
                              className={`p-0.5 sm:p-1 rounded-full ${
                                isMobile
                                  ? "opacity-100"
                                  : "opacity-0 group-hover:opacity-100"
                              } ${hoverBgClass} transition-all cursor-pointer`}
                            >
                              <Smile
                                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${iconClass}`}
                              />
                            </motion.button>
                          </PopoverTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top">React</TooltipContent>
                      </Tooltip>
                      <PopoverContent
                        className="w-auto p-1.5 z-1001"
                        align="end"
                        sideOffset={5}
                      >
                        <div className="flex gap-1">
                          {REACTION_EMOJIS.map((emoji) => {
                            const hasReacted =
                              card.reactions[emoji]?.includes(visitorId) ||
                              false;
                            return (
                              <motion.button
                                key={emoji}
                                type="button"
                                onClick={() => handleReact(emoji)}
                                whileTap={{ scale: 0.85 }}
                                whileHover={{ scale: 1.15 }}
                                className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-base sm:text-lg transition-all cursor-pointer ${
                                  hasReacted
                                    ? "bg-stone-900/15"
                                    : "hover:bg-stone-100 dark:hover:bg-stone-800"
                                }`}
                              >
                                {emoji}
                              </motion.button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  <span
                    className={`text-[10px] sm:text-[11px] font-semibold tabular-nums ${mutedTextClass}`}
                  >
                    <NumberFlow
                      value={card.votes}
                      format={{ notation: "compact" }}
                    />
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileTap={allowVote ? { scale: 0.85 } : undefined}
                        onClick={handleVote}
                        disabled={!allowVote}
                        className={`p-0.5 sm:p-1 rounded-full transition-all ${
                          !allowVote
                            ? "opacity-30 cursor-not-allowed"
                            : hasVoted
                              ? isPurpleDark
                                ? "bg-white/20 text-white"
                                : "bg-stone-900/15 text-stone-800"
                              : `${hoverBgClass} cursor-pointer`
                        }`}
                      >
                        <ChevronUp
                          className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                            hasVoted
                              ? isPurpleDark
                                ? "text-white"
                                : "text-stone-800"
                              : iconClass
                          }`}
                        />
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isOwnCard
                        ? "Can't vote on your own"
                        : session.isLocked
                          ? "Session is locked"
                          : hasVoted
                            ? "Remove vote"
                            : "Vote"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Resize handles - only show when user can move/resize */}
            {allowMove && (
              <>
                {/* Right edge */}
                <div
                  className="resize-handle-e absolute right-0 top-0 bottom-0 w-2 opacity-0 hover:opacity-50 hover:bg-primary/20 transition-opacity z-10 nodrag"
                  onPointerDown={(e) => handleResizeStart(e, "e")}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                {/* Bottom edge */}
                <div
                  className="resize-handle-s absolute bottom-0 left-0 right-0 h-2 opacity-0 hover:opacity-50 hover:bg-primary/20 transition-opacity z-10 nodrag"
                  onPointerDown={(e) => handleResizeStart(e, "s")}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                />
                {/* Bottom-right corner */}
                <div
                  className="resize-handle-se absolute bottom-0 right-0 w-4 h-4 opacity-0 hover:opacity-100 transition-opacity z-20 flex items-center justify-center nodrag"
                  onPointerDown={(e) => handleResizeStart(e, "se")}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                >
                  <GripVertical className="w-3 h-3 rotate-[-45deg] text-muted-foreground" />
                </div>
              </>
            )}
          </div>

          {/* Card-attached threads - rendered outside the card border */}
          {/* Threads are spaced horizontally from right to left, starting from bottom right */}
          {attachedThreads &&
            threadHandlers &&
            attachedThreads.length > 0 &&
            attachedThreads.map((thread, index) => (
              <div
                key={thread.id}
                className="absolute z-50"
                style={{
                  // Space threads horizontally from right edge
                  // Each thread offset by 50px (bubble width ~48px + 2px margin)
                  right: index * 50,
                  bottom: -20,
                }}
              >
                <CardThreadNode
                  thread={thread}
                  userRole={userRole}
                  visitorId={visitorId}
                  sessionLocked={session.isLocked}
                  handlers={threadHandlers}
                />
              </div>
            ))}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={handleAddThread}
          disabled={session.isLocked}
          className="gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Add comment thread
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const IdeaCardNode = memo(IdeaCardNodeComponent);
