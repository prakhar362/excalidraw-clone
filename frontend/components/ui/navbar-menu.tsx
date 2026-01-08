"use client";
import React from "react";
import { motion } from "framer-motion"; // Note: changed to framer-motion for standard imports
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
  return (
    <nav
      onMouseLeave={() => setActive(null)}
      className="relative rounded-full text-wrap border border-black/[0.2] dark:border-white/[0.2] dark:bg-black bg-white shadow-input flex items-center justify-between px-8 py-4 w-full max-w-7xl mx-auto mt-4"
    >
      {/* LEFT: LOGO SECTION */}
      <Link href="/" className="flex items-center gap-2 group">
        <div className="h-8 w-8 bg-black dark:bg-white rounded-lg flex items-center justify-center transition-transform group-hover:rotate-6">
          {/* Simple Pen/Sketch Icon */}
          <svg 
            width="20" height="20" viewBox="0 0 24 24" fill="none" 
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            className="text-white dark:text-black"
          >
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
        </div>
        
      </Link>

      {/* CENTER: NAV ITEMS */}
      <div className="flex items-center space-x-6">
        {children}
      </div>

      {/* RIGHT: AUTH SECTION */}
      <div className="flex items-center gap-4">
        <Link href="/auth">
          <Button variant="default" className="rounded-full px-6 bg-black dark:bg-white dark:text-black hover:opacity-90 transition-opacity">
            Sign up
          </Button>
        </Link>
      </div>
    </nav>
  );
};

// ... MenuItem, ProductItem, and HoveredLink remain the same as your previous code ...

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
    <div onMouseEnter={() => setActive(item)} className="relative">
      <motion.p
        transition={{ duration: 0.3 }}
        className="cursor-pointer text-black hover:opacity-[0.9] dark:text-white font-medium"
      >
        {item}
      </motion.p>
      {active !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
        >
          {active === item && (
            <div className="absolute top-[calc(100%_+_1.2rem)] left-1/2 transform -translate-x-1/2 pt-4">
              <motion.div
                transition={transition}
                layoutId="active"
                className="bg-white dark:bg-black backdrop-blur-sm rounded-2xl overflow-hidden border border-black/[0.2] dark:border-white/[0.2] shadow-xl"
              >
                <motion.div layout className="w-max h-full p-4">
                  {children}
                </motion.div>
              </motion.div>
            </div>
          )}
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
