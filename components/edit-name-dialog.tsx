"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 30;

interface EditNameDialogProps {
  currentName: string;
  onSave: (newName: string) => Promise<{ success: boolean; error?: string }>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditNameDialog({
  currentName,
  onSave,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: EditNameDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled
    ? (controlledOnOpenChange ?? (() => {}))
    : setInternalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Reset state when dialog opens
      setName(currentName);
      setError(null);
    }
  };

  const validateName = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.length < USERNAME_MIN_LENGTH) {
      return `Name must be at least ${USERNAME_MIN_LENGTH} characters`;
    }
    if (trimmed.length > USERNAME_MAX_LENGTH) {
      return `Name must be at most ${USERNAME_MAX_LENGTH} characters`;
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    const result = await onSave(name.trim());

    setIsSaving(false);

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.error ?? "Failed to save name");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSaving) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit your name
          </DialogTitle>
          <DialogDescription>
            This name will be visible to other participants in this session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter your name"
            maxLength={USERNAME_MAX_LENGTH}
            autoFocus
            aria-invalid={!!error}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {name.trim().length}/{USERNAME_MAX_LENGTH} characters
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
