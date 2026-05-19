'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';

interface CartIconProps {
    onClick: () => void;
    className?: string;
}

export const CartIcon = ({ onClick, className = '' }: CartIconProps) => {
    const [itemCount, setItemCount] = useState(0);

    useEffect(() => {
        // Cargar cantidad de items del carrito desde localStorage
        const updateCartCount = () => {
            try {
                const cart = localStorage.getItem('medellin-travel-cart');
                if (cart) {
                    const cartItems = JSON.parse(cart);
                    setItemCount(Array.isArray(cartItems) ? cartItems.length : 0);
                } else {
                    setItemCount(0);
                }
            } catch (error) {
                console.error('Error loading cart count:', error);
                setItemCount(0);
            }
        };

        // Actualizar al montar
        updateCartCount();

        // Escuchar cambios en el carrito
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'medellin-travel-cart') {
                updateCartCount();
            }
        };

        // Escuchar evento personalizado para actualizaciones del carrito
        const handleCartUpdate = () => {
            updateCartCount();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('cartUpdated', handleCartUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('cartUpdated', handleCartUpdate);
        };
    }, []);

    return (
        <button
            onClick={onClick}
            className={`relative p-2 hover:bg-gray-100 rounded-full transition-colors ${className}`}
            aria-label="Carrito de compras"
        >
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D6A75D] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {itemCount > 9 ? '9+' : itemCount}
                </span>
            )}
        </button>
    );
};
