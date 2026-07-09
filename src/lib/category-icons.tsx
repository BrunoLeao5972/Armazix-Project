import {
  // já existentes
  Package, Box, Star, Tag, Gift, Zap, Percent, Baby, PawPrint, Car, Truck,
  Heart, Home, Leaf,
  Smartphone, Laptop, Tv, Monitor, Headphones, Camera, Plug, Battery, Watch, Tablet,
  Shirt, ShoppingBag, Gem, Scissors,
  Coffee, Wine, Pizza, Sandwich, Apple, Flower,
  Wrench, Hammer, Dumbbell, Bike, Trophy,
  BookOpen, Gamepad2, Music,
  Pill, UtensilsCrossed,
  // Eletrônicos / Tech
  Mouse, Keyboard, Wifi, Cpu, Speaker, Printer, HardDrive, Cable, Server, Bluetooth,
  Headset, Joystick, MonitorSmartphone, ScanLine, Usb,
  // Moda / Acessórios
  Crown, Glasses, Footprints, Backpack, Umbrella, Luggage, Diamond, ShoppingCart,
  // Casa / Decoração
  Sofa, Lamp, BedDouble, Bath, Armchair, Refrigerator, WashingMachine, Microwave,
  DoorOpen, Flame, Lightbulb, Drill,
  // Comida / Bebidas
  ChefHat, Cookie, IceCreamCone, Cake, Beef, Salad, Egg, Fish, Carrot,
  Candy, Wheat, Milk, Utensils,
  // Esportes / Ao ar livre
  Mountain, Tent, Snowflake, Sun, TreePine, Compass,
  // Saúde / Beleza
  Stethoscope, HeartPulse, Thermometer, Syringe, Paintbrush, Palette,
  Smile, Sparkles, Bandage,
  // Educação / Serviços
  GraduationCap, School, BookMarked, Pencil, Globe, Building2, Landmark,
  Plane, Hotel, MapPin, Store, Warehouse, Factory, Shield,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  // já existentes
  Package, Box, Star, Tag, Gift, Zap, Percent, Baby, PawPrint, Car, Truck,
  Heart, Home, Leaf,
  Smartphone, Laptop, Tv, Monitor, Headphones, Camera, Plug, Battery, Watch, Tablet,
  Shirt, ShoppingBag, Gem, Scissors,
  Coffee, Wine, Pizza, Sandwich, Apple, Flower,
  Wrench, Hammer, Dumbbell, Bike, Trophy,
  BookOpen, Gamepad2, Music,
  Pill, UtensilsCrossed,
  // Eletrônicos / Tech
  Mouse, Keyboard, Wifi, Cpu, Speaker, Printer, HardDrive, Cable, Server, Bluetooth,
  Headset, Joystick, MonitorSmartphone, ScanLine, Usb,
  // Moda / Acessórios
  Crown, Glasses, Footprints, Backpack, Umbrella, Luggage, Diamond, ShoppingCart,
  // Casa / Decoração
  Sofa, Lamp, BedDouble, Bath, Armchair, Refrigerator, WashingMachine, Microwave,
  DoorOpen, Flame, Lightbulb, Drill,
  // Comida / Bebidas
  ChefHat, Cookie, IceCreamCone, Cake, Beef, Salad, Egg, Fish, Carrot,
  Candy, Wheat, Milk, Utensils,
  // Esportes / Ao ar livre
  Mountain, Tent, Snowflake, Sun, TreePine, Compass,
  // Saúde / Beleza
  Stethoscope, HeartPulse, Thermometer, Syringe, Paintbrush, Palette,
  Smile, Sparkles, Bandage,
  // Educação / Serviços
  GraduationCap, School, BookMarked, Pencil, Globe, Building2, Landmark,
  Plane, Hotel, MapPin, Store, Warehouse, Factory, Shield,
};

export const CATEGORY_ICONS: { name: string; label: string }[] = [
  // ── Geral / Loja ──────────────────────────────────────────────
  { name: "Package",           label: "Geral"        },
  { name: "Store",             label: "Loja"         },
  { name: "ShoppingCart",      label: "Carrinho"     },
  { name: "ShoppingBag",       label: "Sacola"       },
  { name: "Tag",               label: "Promoção"     },
  { name: "Percent",           label: "Desconto"     },
  { name: "Zap",               label: "Ofertas"      },
  { name: "Gift",              label: "Presentes"    },
  { name: "Star",              label: "Destaque"     },
  { name: "Sparkles",          label: "Premium"      },
  { name: "Box",               label: "Caixas"       },

  // ── Eletrônicos / Tech ────────────────────────────────────────
  { name: "Smartphone",        label: "Celular"      },
  { name: "Laptop",            label: "Notebook"     },
  { name: "Tablet",            label: "Tablet"       },
  { name: "Tv",                label: "TV"           },
  { name: "Monitor",           label: "Monitor"      },
  { name: "Headphones",        label: "Fones"        },
  { name: "Headset",           label: "Headset"      },
  { name: "Speaker",           label: "Caixa Som"    },
  { name: "Camera",            label: "Câmera"       },
  { name: "Keyboard",          label: "Teclado"      },
  { name: "Mouse",             label: "Mouse"        },
  { name: "Printer",           label: "Impressora"   },
  { name: "HardDrive",         label: "HD/SSD"       },
  { name: "Server",            label: "Servidor"     },
  { name: "Cpu",               label: "CPU"          },
  { name: "Cable",             label: "Cabo"         },
  { name: "Usb",               label: "USB"          },
  { name: "Bluetooth",         label: "Bluetooth"    },
  { name: "Wifi",              label: "Wi-Fi"        },
  { name: "Plug",              label: "Elétrica"     },
  { name: "Battery",           label: "Bateria"      },
  { name: "Joystick",          label: "Joystick"     },
  { name: "Gamepad2",          label: "Games"        },
  { name: "ScanLine",          label: "Scanner"      },
  { name: "MonitorSmartphone", label: "Multi-tela"   },

  // ── Moda / Acessórios ─────────────────────────────────────────
  { name: "Shirt",             label: "Roupas"       },
  { name: "Gem",               label: "Joias"        },
  { name: "Crown",             label: "Coroa"        },
  { name: "Diamond",               label: "Diamante"     },
  { name: "Watch",             label: "Relógio"      },
  { name: "Glasses",           label: "Óculos"       },
  { name: "Footprints",        label: "Calçados"     },
  { name: "Backpack",          label: "Mochila"      },
  { name: "Luggage",           label: "Mala"         },
  { name: "Umbrella",          label: "Guarda-sol"   },
  { name: "Scissors",          label: "Beleza"       },

  // ── Casa / Decoração ──────────────────────────────────────────
  { name: "Home",              label: "Casa"         },
  { name: "Sofa",              label: "Sofá"         },
  { name: "Armchair",          label: "Poltrona"     },
  { name: "BedDouble",         label: "Cama"         },
  { name: "Bath",              label: "Banheiro"     },
  { name: "Lamp",              label: "Luminária"    },
  { name: "Lightbulb",         label: "Iluminação"   },
  { name: "DoorOpen",          label: "Portas"       },
  { name: "Refrigerator",      label: "Geladeira"    },
  { name: "Microwave",         label: "Micro-ondas"  },
  { name: "WashingMachine",    label: "Lavanderia"   },
  { name: "Flame",             label: "Lareira"      },

  // ── Comida / Bebidas ──────────────────────────────────────────
  { name: "UtensilsCrossed",   label: "Refeições"    },
  { name: "Utensils",          label: "Restaurante"  },
  { name: "ChefHat",           label: "Chef"         },
  { name: "Coffee",            label: "Café"         },
  { name: "Wine",              label: "Bebidas"      },
  { name: "Pizza",             label: "Pizza"        },
  { name: "Sandwich",          label: "Lanches"      },
  { name: "Beef",              label: "Carnes"       },
  { name: "Fish",              label: "Peixes"       },
  { name: "Salad",             label: "Saladas"      },
  { name: "Cake",              label: "Bolos"        },
  { name: "Cookie",            label: "Confeitaria"  },
  { name: "IceCreamCone",      label: "Sorvete"      },
  { name: "Candy",             label: "Doces"        },
  { name: "Apple",             label: "Frutas"       },
  { name: "Carrot",            label: "Verduras"     },
  { name: "Egg",               label: "Ovos"         },
  { name: "Milk",              label: "Laticínios"   },
  { name: "Wheat",             label: "Grãos"        },

  // ── Esportes / Outdoor ────────────────────────────────────────
  { name: "Dumbbell",          label: "Academia"     },
  { name: "Bike",              label: "Ciclismo"     },
  { name: "Trophy",            label: "Esportes"     },
  { name: "Mountain",          label: "Trilha"       },
  { name: "Tent",              label: "Camping"      },
  { name: "Compass",           label: "Aventura"     },
  { name: "Snowflake",         label: "Inverno"      },
  { name: "Sun",               label: "Verão"        },

  // ── Saúde / Beleza ────────────────────────────────────────────
  { name: "Heart",             label: "Saúde"        },
  { name: "HeartPulse",        label: "Cardio"       },
  { name: "Stethoscope",       label: "Médico"       },
  { name: "Thermometer",       label: "Temperatura"  },
  { name: "Syringe",           label: "Farmácia"     },
  { name: "Pill",              label: "Remédios"     },
  { name: "Bandage",           label: "Primeiros S." },
  { name: "Smile",             label: "Bem-Estar"    },
  { name: "Paintbrush",        label: "Pintura"      },
  { name: "Palette",           label: "Arte"         },

  // ── Educação / Serviços ───────────────────────────────────────
  { name: "BookOpen",          label: "Livros"       },
  { name: "BookMarked",        label: "Apostilas"    },
  { name: "GraduationCap",     label: "Educação"     },
  { name: "School",            label: "Escola"       },
  { name: "Pencil",            label: "Papelaria"    },
  { name: "Music",             label: "Música"       },

  // ── Veículos / Logística ──────────────────────────────────────
  { name: "Car",               label: "Automotivo"   },
  { name: "Truck",             label: "Entregas"     },
  { name: "Plane",             label: "Aviação"      },
  { name: "Bike",              label: "Bicicleta"    },
  { name: "Drill",             label: "Elétricos"    },

  // ── Ferramentas / Construção ──────────────────────────────────
  { name: "Wrench",            label: "Ferramentas"  },
  { name: "Hammer",            label: "Construção"   },
  { name: "Shield",            label: "Segurança"    },
  { name: "Warehouse",         label: "Depósito"     },
  { name: "Factory",           label: "Indústria"    },

  // ── Natureza / Jardim ─────────────────────────────────────────
  { name: "Leaf",              label: "Natural"      },
  { name: "Flower",            label: "Flores"       },
  { name: "TreePine",          label: "Jardim"       },
  { name: "PawPrint",          label: "Pet"          },

  // ── Infantil ──────────────────────────────────────────────────
  { name: "Baby",              label: "Bebê"         },

  // ── B2B / Empresarial ─────────────────────────────────────────
  { name: "Building2",         label: "Empresa"      },
  { name: "Landmark",          label: "Corporativo"  },
  { name: "Hotel",             label: "Hotelaria"    },
  { name: "Globe",             label: "Global"       },
  { name: "MapPin",            label: "Localização"  },
];

interface CategoryIconProps {
  name?: string | null;
  className?: string;
}

export function CategoryIcon({ name, className = "w-5 h-5" }: CategoryIconProps) {
  const Icon: LucideIcon = (name ? ICON_MAP[name] : undefined) ?? Package;
  return <Icon className={className} />;
}
