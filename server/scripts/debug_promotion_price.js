import dotenv from "dotenv";
import mongoose from "mongoose";
import Promotion from "../src/infrastructure/database/models/Promotion.js";

dotenv.config({ path: "./.env" });

async function main() {
  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    mongoUri = process.env.MONGO_URI;
  }
  if (!mongoUri) {
    mongoUri = "mongodb://localhost:27017/essence";
  }

  await mongoose.connect(mongoUri);

  const promoId = process.argv[2];
  if (!promoId) {
    console.error("Missing promotion id argument");
    process.exit(1);
  }

  const promo = await Promotion.findById(promoId).lean();
  if (!promo) {
    console.error("Promotion not found");
    process.exit(1);
  }

  const comboItems = (promo.comboItems || []).map((item) => ({
    product: item?.product?.toString ? item.product.toString() : item?.product,
    unitPrice: item?.unitPrice,
    quantity: item?.quantity,
  }));

  console.log(
    JSON.stringify(
      {
        _id: promo._id,
        name: promo.name,
        promotionPrice: promo.promotionPrice,
        employeePrice: promo.employeePrice,
        comboItems,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
