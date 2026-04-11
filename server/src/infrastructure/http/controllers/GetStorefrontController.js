import { GetPublicStorefrontUseCase } from "../../../application/use-cases/public-storefront/GetPublicStorefrontUseCase.js";

const getPublicStorefrontUseCase = new GetPublicStorefrontUseCase();

export class GetStorefrontController {
  async getBySlug(req, res) {
    try {
      const storefront = await getPublicStorefrontUseCase.execute(
        req.params.slug,
      );
      return res.json({ success: true, data: storefront });
    } catch (error) {
      const status = error.statusCode || 500;
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
  }
}

export default new GetStorefrontController();
