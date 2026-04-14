import dotenv from "dotenv";
import mongoose from "mongoose";
import Sale from "../src/infrastructure/database/models/Sale.js";

dotenv.config({ path: "server/.env" });

const calculate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to DB");

    const sales = await Sale.find({
      business: new mongoose.Types.ObjectId("697963c5af6ac901be43bf57"), // Assuming this is the business
      employee: new mongoose.Types.ObjectId("697965a5af6ac901be43c23e"),
    }).lean();

    console.log(`Found ${sales.length} confirmed sales`);

    let rankingProfit = 0; // Price - Cost - Comm
    let kpiProfit = 0; // Price - Cost - Comm - Shipping

    sales.forEach((s) => {
      const price = (s.salePrice || 0) * s.quantity;
      const cost = (s.averageCostAtSale || s.purchasePrice || 0) * s.quantity;
      const comm = s.employeeProfit || 0;
      const shipping = s.shippingCost || 0;

      const pRanking = price - cost - comm;
      const pKpi = price - cost - comm - shipping;

      if (s.employee) {
        // Assuming we filter for specific employee in ranking, but let's sum global to compare
      }

      // console.log(`Sale ${s._id}: Price=${price}, Cost=${cost}, Comm=${comm}, Ship=${shipping} -> Rank=${pRanking}, KPI=${pKpi}`);

      console.log(
        `Sale ${s._id}: P=${price}, C=${cost}, Comm=${comm}, Ship=${shipping} -> Rank=${pRanking}, KPI=${pKpi}`,
      );
      rankingProfit += pRanking;
      kpiProfit += pKpi;
    });

    console.log("--- TOTALS ---");
    console.log(`Ranking Logic (No Ship): $${Math.round(rankingProfit)}`);
    console.log(`KPI Logic (With Ship): $${Math.round(kpiProfit)}`);
  } catch (e) {
    console.error(e);
  } finally {
    mongoose.disconnect();
  }
};

calculate();
