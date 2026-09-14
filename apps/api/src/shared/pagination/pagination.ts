export type PaginationInput = Readonly<{
  page?: number | undefined;
  pageSize?: number | undefined;
}>;

export type ResolvedPagination = Readonly<{
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}>;

export function resolvePagination(
  input: PaginationInput,
  defaultPageSize = 20,
): ResolvedPagination {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? defaultPageSize;
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function paginationMetadata(
  pagination: ResolvedPagination,
  totalItems: number,
): Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}> {
  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pagination.pageSize),
  };
}
