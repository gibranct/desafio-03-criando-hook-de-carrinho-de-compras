import { createContext, ReactNode, useContext, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../services/api';
import { Product, Stock } from '../types';

interface CartProviderProps {
  children: ReactNode;
}

interface UpdateProductAmount {
  productId: number;
  amount: number;
}

interface CartContextData {
  cart: Product[];
  addProduct: (productId: number) => Promise<void>;
  removeProduct: (productId: number) => void;
  updateProductAmount: ({ productId, amount }: UpdateProductAmount) => void;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

const CART_KEY = '@RocketShoes:cart'
const outOfStockMessage = 'Quantidade solicitada fora de estoque'

export function CartProvider({ children }: CartProviderProps): JSX.Element {
  const [cart, setCart] = useState<Product[]>(() => {
    const storagedCart = localStorage.getItem(CART_KEY)

    if (storagedCart) {
      return JSON.parse(storagedCart);
    }

    return [];
  });

  const updateCartValues = (newCartValues: Product[]) => {
    setCart(newCartValues)
    localStorage.setItem(CART_KEY, JSON.stringify(newCartValues))
  }

  const updateAmountValue = (productId: number, newAmount: number) => {
    return (product: Product) => {
       if (product.id === productId) {
        return {
          ...product,
          amount: newAmount
        }
      }
      return product
    }
  }

  const addProduct = async (productId: number) => {
    try {
      const { data: stock } = await api.get<Stock>(`/stock/${productId}`)
      const isStockEmpty = stock.amount < 1
      if (isStockEmpty) {
        toast.error(outOfStockMessage);
        return
      }
      const { data: product } = await api.get(`/products/${productId}`);
      const productExists = cart.find(product => product.id === productId)
      const newAmount = productExists ? (productExists.amount + 1) : 1
      let newCartValues: Array<Product>
      if (newAmount > stock.amount) {
        toast.error(outOfStockMessage);
        return
      }
      if (productExists) {
        newCartValues = cart.map(updateAmountValue(productId, newAmount))
      } else {
        newCartValues = [...cart, { ...product, amount: 1 }]
      }
      updateCartValues(newCartValues)
    } catch {
      toast.error('Erro na adição do produto');
    }
  };

  const removeProduct = (productId: number) => {
    try {
      const newCartValues = cart.filter(product => product.id !== productId)
      if (newCartValues.length !== cart.length) {
        return updateCartValues(newCartValues)
      }
      toast.error('Erro na remoção do produto');
    } catch {
      toast.error('Erro na remoção do produto');
    }
  };

  const updateProductAmount = async ({
    productId,
    amount,
  }: UpdateProductAmount) => {
    try {
      if (amount <= 0) return
      const { data: stock } = await api.get<Stock>(`/stock/${productId}`)
      if (amount > stock.amount) {
        toast.error(outOfStockMessage);
        return
      }
      const newCartValues = cart.map(updateAmountValue(productId, amount))
      updateCartValues(newCartValues)
    } catch {
      toast.error('Erro na alteração de quantidade do produto');
    }
  };

  return (
    <CartContext.Provider
      value={{ cart, addProduct, removeProduct, updateProductAmount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextData {
  const context = useContext(CartContext);

  return context;
}
