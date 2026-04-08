import HttpSalesReadRepository from "../../infrastructure/http/sales/HttpSalesReadRepository";
import HttpSalesWriteRepository from "../../infrastructure/http/sales/HttpSalesWriteRepository";
import SalesReadUseCases from "./SalesReadUseCases";
import SalesWriteUseCases from "./SalesWriteUseCases";

const salesReadRepository = new HttpSalesReadRepository();
const salesWriteRepository = new HttpSalesWriteRepository();

export const salesReadUseCases = new SalesReadUseCases(salesReadRepository);
export const salesWriteUseCases = new SalesWriteUseCases(salesWriteRepository);

export default salesReadUseCases;
