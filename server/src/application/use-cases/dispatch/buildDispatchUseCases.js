import DispatchRepositoryAdapter from "../../../infrastructure/adapters/repositories/DispatchRepositoryAdapter.js";
import ConfirmDispatchReceptionUseCase from "./ConfirmDispatchReceptionUseCase.js";
import CreateDispatchRequestUseCase from "./CreateDispatchRequestUseCase.js";
import GetDispatchByIdUseCase from "./GetDispatchByIdUseCase.js";
import GetDispatchHotSectorsUseCase from "./GetDispatchHotSectorsUseCase.js";
import GetPendingDispatchCountUseCase from "./GetPendingDispatchCountUseCase.js";
import ListDispatchRequestsUseCase from "./ListDispatchRequestsUseCase.js";
import MarkDispatchAsDispatchedUseCase from "./MarkDispatchAsDispatchedUseCase.js";

const dispatchRepository = new DispatchRepositoryAdapter();

export const dispatchUseCases = {
  createDispatchRequestUseCase: new CreateDispatchRequestUseCase(
    dispatchRepository,
  ),
  listDispatchRequestsUseCase: new ListDispatchRequestsUseCase(
    dispatchRepository,
  ),
  getDispatchByIdUseCase: new GetDispatchByIdUseCase(dispatchRepository),
  markDispatchAsDispatchedUseCase: new MarkDispatchAsDispatchedUseCase(
    dispatchRepository,
  ),
  confirmDispatchReceptionUseCase: new ConfirmDispatchReceptionUseCase(
    dispatchRepository,
  ),
  getPendingDispatchCountUseCase: new GetPendingDispatchCountUseCase(
    dispatchRepository,
  ),
  getDispatchHotSectorsUseCase: new GetDispatchHotSectorsUseCase(
    dispatchRepository,
  ),
};
