import HttpDispatchRepository from "../../infrastructure/http/dispatch/HttpDispatchRepository";
import DispatchUseCases from "./DispatchUseCases";

const dispatchRepository = new HttpDispatchRepository();

export const dispatchUseCases = new DispatchUseCases(dispatchRepository);

export default dispatchUseCases;
