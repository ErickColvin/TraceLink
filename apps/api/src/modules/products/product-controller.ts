import type { RequestHandler } from "express";
import {
  productAdminListParamsSchema,
  productCommercialInputSchema,
  productIdParamsSchema,
  productListParamsSchema,
  productSlugParamsSchema,
  relatedProductsQuerySchema,
  setProductActiveRequestSchema,
  setProductPublishedRequestSchema,
} from "@tracelink/contracts";

import { getAuthContext } from "../../middleware/authenticate.js";
import { getResponseRequestId } from "../../middleware/request-id.js";
import { parseWithSchema } from "../../shared/validation/parse.js";
import type { ProductService } from "./product-service.js";

export function createProductController(service: ProductService): Readonly<{
  listPublic: RequestHandler;
  listStaff: RequestHandler;
  listCategories: RequestHandler;
  getPublicBySlug: RequestHandler;
  getStaffById: RequestHandler;
  listRelated: RequestHandler;
  create: RequestHandler;
  update: RequestHandler;
  setActive: RequestHandler;
  setPublished: RequestHandler;
}> {
  return {
    listPublic: async (request, response) => {
      const params = parseWithSchema(productListParamsSchema, request.query, "query");
      response.status(200).json(await service.listPublic(params));
    },
    listStaff: async (request, response) => {
      const params = parseWithSchema(
        productAdminListParamsSchema,
        request.query,
        "query",
      );
      const auth = getAuthContext(request);
      response.status(200).json(await service.listStaff(auth.organization.id, params));
    },
    listCategories: async (_request, response) => {
      response.status(200).json(await service.listCategories());
    },
    getPublicBySlug: async (request, response) => {
      const { slug } = parseWithSchema(productSlugParamsSchema, request.params, "params");
      response.status(200).json(await service.getPublicBySlug(slug));
    },
    getStaffById: async (request, response) => {
      const { id } = parseWithSchema(productIdParamsSchema, request.params, "params");
      const auth = getAuthContext(request);
      response.status(200).json(await service.getStaffById(auth.organization.id, id));
    },
    listRelated: async (request, response) => {
      const { slug } = parseWithSchema(productSlugParamsSchema, request.params, "params");
      const { limit } = parseWithSchema(
        relatedProductsQuerySchema,
        request.query,
        "query",
      );
      response.status(200).json(await service.listRelated(slug, limit));
    },
    create: async (request, response) => {
      const input = parseWithSchema(productCommercialInputSchema, request.body, "body");
      const auth = getAuthContext(request);
      const product = await service.create({
        organizationId: auth.organization.id,
        actorUserId: auth.user.id,
        input,
        requestId: getResponseRequestId(response),
      });
      response.status(201).json(product);
    },
    update: async (request, response) => {
      const { id } = parseWithSchema(productIdParamsSchema, request.params, "params");
      const input = parseWithSchema(productCommercialInputSchema, request.body, "body");
      const auth = getAuthContext(request);
      response.status(200).json(
        await service.update({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          productId: id,
          input,
          requestId: getResponseRequestId(response),
        }),
      );
    },
    setActive: async (request, response) => {
      const { id } = parseWithSchema(productIdParamsSchema, request.params, "params");
      const { active } = parseWithSchema(
        setProductActiveRequestSchema,
        request.body,
        "body",
      );
      const auth = getAuthContext(request);
      response.status(200).json(
        await service.setActive({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          productId: id,
          active,
          requestId: getResponseRequestId(response),
        }),
      );
    },
    setPublished: async (request, response) => {
      const { id } = parseWithSchema(productIdParamsSchema, request.params, "params");
      const { published } = parseWithSchema(
        setProductPublishedRequestSchema,
        request.body,
        "body",
      );
      const auth = getAuthContext(request);
      response.status(200).json(
        await service.setPublished({
          organizationId: auth.organization.id,
          actorUserId: auth.user.id,
          productId: id,
          published,
          requestId: getResponseRequestId(response),
        }),
      );
    },
  };
}
