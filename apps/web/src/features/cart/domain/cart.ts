export type CartProductInput = {
  id: string;
  slug: string;
  name: string;
  salePrice: number;
  availableStock: number;
  imageUrl?: string;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  unitPrice: number;
  quantity: number;
  availableStock: number;
  imageUrl?: string;
};

export type CartState = {
  items: CartItem[];
};

