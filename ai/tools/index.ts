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
}

export function tools({ sessionId, userId }: ToolParams) {
  return {
    createCard: createCardTool({ sessionId, userId }),
    editCard: editCardTool({ sessionId, userId }),
    deleteCards: deleteCardsTool({ sessionId, userId }),
    moveCards: moveCardsTool({ sessionId, userId }),
    changeColor: changeColorTool({ sessionId, userId }),
    summarizeCards: summarizeCardsTool({ sessionId, userId }),
    findSimilar: findSimilarTool({ sessionId, userId }),
    clusterCards: clusterCardsTool({ sessionId, userId }),
  };
}

export type ToolSet = ReturnType<typeof tools>;
