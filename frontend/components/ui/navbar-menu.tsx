"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu as MenuIcon, X } from "lucide-react";

const transition = {
  type: "spring",
  mass: 0.5,
  damping: 11.5,
  stiffness: 100,
  restDelta: 0.001,
  restSpeed: 0.001,
};

export const Menu = ({
  setActive,
  children,
}: {
  setActive: (item: string | null) => void;
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="relative mx-auto mt-4 flex w-[calc(100%-2rem)] max-w-7xl items-center justify-between rounded-full border border-black/[0.2] bg-white px-8 py-4 shadow-input dark:border-white/[0.2] dark:bg-black"
    >
      {/* LEFT: LOGO */}
      <Link href="/" className="flex shrink-0 items-center gap-2 group">
        <div className="h-8 w-8 bg-black dark:bg-white rounded-lg flex items-center justify-center transition-transform group-hover:rotate-6">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white dark:text-black">
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
        </div>
        <span className="font-bold text-md text-black dark:text-white md:hidden xs:block">Sketchcalibur</span>
      </Link>

      {/* CENTER: DESKTOP NAV ITEMS (Unchanged for Desktop) */}
      <div className="hidden md:flex items-center space-x-6">
        {children}
      </div>

      {/* RIGHT: AUTH & MOBILE TOGGLE */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <Link href="/auth">
            <Button variant="default" className="rounded-full px-6 bg-black dark:bg-white dark:text-black">
              Sign up
            </Button>
          </Link>
        </div>

        {/* Hamburger Icon - Only Mobile */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 text-black dark:text-white"
        >
          {isOpen ? <X size={24} /> : <MenuIcon size={24} />}
        </button>
      </div>

      {/* MOBILE MENU DRAWER */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-3 p-4 bg-white dark:bg-black border border-black/[0.1] dark:border-white/[0.1] rounded-3xl shadow-xl md:hidden flex flex-col gap-4 z-50"
          >
            <div className="flex flex-col items-start gap-4 px-4 py-2">
              {children}
            </div>
            <Link href="/auth" className="w-full px-2 pb-2">
              <Button className="w-full rounded-xl">Get Started</Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export const MenuItem = ({
  setActive,
  active,
  item,
  children,
}: {
  setActive: (item: string) => void;
  active: string | null;
  item: string;
  children?: React.ReactNode;
}) => {
  return (
    <div 
      onMouseEnter={() => setActive(item)} 
      onClick={() => setActive(item)} // Helpful for mobile touch
      className="relative"
    >
      <motion.p
        transition={{ duration: 0.3 }}
        className="cursor-pointer text-black hover:opacity-[0.9] dark:text-white font-medium"
      >
        {item}
      </motion.p>
      {active === item && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
          className="absolute top-[calc(100%_+_1.2rem)] left-1/2 transform -translate-x-1/2 md:pt-4 z-[100]"
        >
          <div className="bg-white dark:bg-black backdrop-blur-sm rounded-2xl overflow-hidden border border-black/[0.2] dark:border-white/[0.2] shadow-xl">
            <div className="w-max h-full p-4">
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};


export const HoveredLink = ({ children, ...rest }: any) => {
  return (
    <a
      {...rest}
      className="text-neutral-700 dark:text-neutral-200 hover:text-black "
    >
      {children}
    </a>
  );
};
