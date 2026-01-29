import type { SessionRole } from "@/db/schema";
import { changeColorTool } from "./change-color";
import { clusterCardsTool } from "./cluster-cards";
import { createCardTool } from "./create-card";
import { deleteCardsTool } from "./delete-cards";
import { editCardTool } from "./edit-card";
import { findSimilarTool } from "./find-similar";
import { moveCardsTool } from "./move-cards";
import { summarizeCardsTool } from "./summarize-cards";

export interface ToolParams {
  sessionId: string;
  userId: string;
  userRole: SessionRole;
}

export function tools({ sessionId, userId, userRole }: ToolParams) {
  return {
    createCard: createCardTool({ sessionId, userId, userRole }),
    editCard: editCardTool({ sessionId, userId, userRole }),
    deleteCards: deleteCardsTool({ sessionId, userId, userRole }),
    moveCards: moveCardsTool({ sessionId, userId, userRole }),
    changeColor: changeColorTool({ sessionId, userId, userRole }),
    summarizeCards: summarizeCardsTool({ sessionId, userId, userRole }),
    findSimilar: findSimilarTool({ sessionId, userId, userRole }),
    clusterCards: clusterCardsTool({ sessionId, userId, userRole }),
  };
}

export type ToolSet = ReturnType<typeof tools>;
