import type { Product, ProductCategory } from "../domain";

export const mockProductCategories = [
  {
    id: "category-frozen",
    slug: "congelados",
    name: "Congelados",
    description: "Alternativas prácticas para mantener siempre a mano.",
    imageUrl:
      "https://images.unsplash.com/photo-1584473457493-17c4c24290c8?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "category-meat",
    slug: "carnes-y-pescados",
    name: "Carnes y pescados",
    description: "Cortes seleccionados y productos del mar.",
    imageUrl:
      "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "category-pantry",
    slug: "despensa",
    name: "Despensa",
    description: "Esenciales para la cocina de todos los días.",
    imageUrl:
      "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "category-drinks",
    slug: "bebidas",
    name: "Bebidas",
    description: "Opciones refrescantes para compartir.",
    imageUrl:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=900&q=80",
  },
] satisfies readonly ProductCategory[];

export const mockProducts = [
  {
    id: "product-empanadas-queso",
    sku: "CON-EMP-001",
    barcode: "7801234500018",
    slug: "empanadas-de-queso-coctel-20-unidades",
    name: "Empanadas de queso cóctel 20 unidades",
    description:
      "Empanadas horneables de masa crujiente con abundante relleno de queso. Listas en pocos minutos.",
    brand: "Sabores del Sur",
    categoryId: "category-frozen",
    salePrice: 6990,
    imageUrl:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1000&q=85",
    availableStock: 38,
    minimumStock: 12,
    published: true,
    active: true,
    featured: true,
  },
  {
    id: "product-berries",
    sku: "CON-FRU-004",
    barcode: "7801234500049",
    slug: "mix-de-berries-congelados-500-g",
    name: "Mix de berries congelados 500 g",
    description:
      "Mezcla de frutillas, arándanos, frambuesas y moras, ideal para batidos, postres y desayunos.",
    brand: "Valle Frío",
    categoryId: "category-frozen",
    salePrice: 5490,
    imageUrl:
      "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1000&q=85",
    availableStock: 26,
    minimumStock: 10,
    published: true,
    active: true,
    featured: true,
  },
  {
    id: "product-papas",
    sku: "CON-PAP-002",
    barcode: "7801234500025",
    slug: "papas-prefritas-corte-tradicional-1-kg",
    name: "Papas prefritas corte tradicional 1 kg",
    description:
      "Papas seleccionadas con corte tradicional, exterior crocante e interior suave.",
    brand: "Campo Noble",
    categoryId: "category-frozen",
    salePrice: 4290,
    imageUrl:
      "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=1000&q=85",
    availableStock: 0,
    minimumStock: 15,
    published: true,
    active: true,
    featured: false,
  },
  {
    id: "product-merluza",
    sku: "PES-MER-010",
    barcode: "7801234500100",
    slug: "filetes-de-merluza-austral-800-g",
    name: "Filetes de merluza austral 800 g",
    description:
      "Filetes sin piel, porcionados y congelados de forma individual para conservar su frescura.",
    brand: "Costa Austral",
    categoryId: "category-meat",
    salePrice: 8990,
    imageUrl:
      "https://images.unsplash.com/photo-1534948216015-843149f72be3?auto=format&fit=crop&w=1000&q=85",
    availableStock: 17,
    minimumStock: 8,
    published: true,
    active: true,
    featured: true,
  },
  {
    id: "product-hamburguesas",
    sku: "CAR-HAM-006",
    barcode: "7801234500063",
    slug: "hamburguesas-angus-6-unidades",
    name: "Hamburguesas Angus 6 unidades",
    description:
      "Hamburguesas de vacuno Angus con 150 g por unidad, sin saborizantes artificiales.",
    brand: "Reserva Ganadera",
    categoryId: "category-meat",
    salePrice: 10990,
    imageUrl:
      "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1000&q=85",
    availableStock: 9,
    minimumStock: 10,
    published: true,
    active: true,
    featured: true,
  },
  {
    id: "product-pollo",
    sku: "CAR-POL-009",
    barcode: "7801234500094",
    slug: "pechuga-de-pollo-deshuesada-1-kg",
    name: "Pechuga de pollo deshuesada 1 kg",
    description:
      "Pechugas de pollo sin piel, envasadas y congeladas para una preparación sencilla.",
    brand: "Granja Central",
    categoryId: "category-meat",
    salePrice: 7490,
    imageUrl:
      "https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=1000&q=85",
    availableStock: 31,
    minimumStock: 12,
    published: true,
    active: true,
    featured: false,
  },
  {
    id: "product-aceite",
    sku: "DES-ACE-003",
    barcode: "7801234500032",
    slug: "aceite-de-oliva-extra-virgen-500-ml",
    name: "Aceite de oliva extra virgen 500 ml",
    description:
      "Aceite de primera extracción en frío, de aroma frutado y acidez equilibrada.",
    brand: "Olivos del Valle",
    categoryId: "category-pantry",
    salePrice: 7990,
    imageUrl:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1000&q=85",
    availableStock: 22,
    minimumStock: 6,
    published: true,
    active: true,
    featured: true,
  },
  {
    id: "product-arroz",
    sku: "DES-ARR-007",
    barcode: "7801234500070",
    slug: "arroz-grado-1-largo-fino-1-kg",
    name: "Arroz grado 1 largo fino 1 kg",
    description:
      "Arroz de grano largo y uniforme, seleccionado para lograr preparaciones sueltas.",
    brand: "Cosecha Nacional",
    categoryId: "category-pantry",
    salePrice: 2190,
    imageUrl:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1000&q=85",
    availableStock: 54,
    minimumStock: 18,
    published: true,
    active: true,
    featured: false,
  },
  {
    id: "product-jugo",
    sku: "BEB-JUG-005",
    barcode: "7801234500056",
    slug: "jugo-de-naranja-sin-azucar-1-l",
    name: "Jugo de naranja sin azúcar 1 L",
    description:
      "Jugo de naranja elaborado con fruta seleccionada, sin azúcar añadida ni preservantes.",
    brand: "Huerto Vivo",
    categoryId: "category-drinks",
    salePrice: 3290,
    imageUrl:
      "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=1000&q=85",
    availableStock: 14,
    minimumStock: 10,
    published: true,
    active: true,
    featured: false,
  },
  {
    id: "product-agua",
    sku: "BEB-AGU-008",
    barcode: "7801234500087",
    slug: "agua-mineral-con-gas-pack-6",
    name: "Agua mineral con gas pack 6",
    description:
      "Seis botellas de 500 ml de agua mineral gasificada, ideal para servir fría.",
    brand: "Cordillera",
    categoryId: "category-drinks",
    salePrice: 4590,
    imageUrl:
      "https://images.unsplash.com/photo-1606168094336-48f205276929?auto=format&fit=crop&w=1000&q=85",
    availableStock: 20,
    minimumStock: 8,
    published: true,
    active: true,
    featured: false,
  },
] satisfies readonly Product[];
