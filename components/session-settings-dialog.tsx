"use client";

import { Lock, Settings, Trash2, Unlock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Session } from "@/db/schema";

interface SessionSettingsDialogProps {
  session: Session;
  onUpdateSettings: (settings: {
    isLocked?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteSession: () => Promise<{ success: boolean; error?: string }>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SessionSettingsDialog({
  session,
  onUpdateSettings,
  onDeleteSession,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SessionSettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (value: boolean) => controlledOnOpenChange?.(value)
    : setInternalOpen;
  const [isLocked, setIsLocked] = useState(session.isLocked);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset to current session values
      setIsLocked(session.isLocked);
      setError(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await onDeleteSession();

    setIsDeleting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to delete session");
    }
    // If successful, the page will redirect, so no need to close dialog
  };

  const handleLockToggle = async () => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    setIsSaving(true);
    setError(null);

    const result = await onUpdateSettings({ isLocked: newLocked });

    setIsSaving(false);

    if (!result.success) {
      setIsLocked(!newLocked); // Revert
      setError(result.error ?? "Failed to update lock status");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Session Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Session Settings
          </DialogTitle>
          <DialogDescription>
            Lock the session or delete it permanently.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Lock/Unlock Toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-sm font-medium flex items-center gap-2">
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-destructive" />
                  ) : (
                    <Unlock className="h-4 w-4 text-green-600" />
                  )}
                  Session Lock
                </span>
                <p className="text-xs text-muted-foreground">
                  {isLocked
                    ? "Session is frozen. Only you can interact with cards."
                    : "Session is active. Everyone can collaborate freely."}
                </p>
              </div>
              <Button
                variant={isLocked ? "destructive" : "outline"}
                size="sm"
                onClick={handleLockToggle}
                disabled={isSaving}
              >
                {isLocked ? "Unlock" : "Lock"}
              </Button>
            </div>
          </div>

          {/* Danger Zone - Delete Session */}
          <div className="border-t pt-4 space-y-2">
            <span className="text-sm font-medium text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Danger Zone
            </span>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Delete Session
              </Button>
            ) : (
              <div className="space-y-2 p-3 bg-destructive/10 rounded-md">
                <p className="text-sm text-destructive">
                  Are you sure? This will permanently delete this session and
                  all its cards.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
